"use client";

import { Fragment, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Coupon,
  createCoupon,
  deleteCoupon,
  listAdminCoupons,
  updateCoupon,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { describeError, Category, CouponDiscountType } from "@/lib/api";
import { CATEGORY_LABELS, formatDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Categories currently on sale — `founder` is retired (see CATEGORY_LABELS).
const COUPON_CATEGORIES: Category[] = ["student", "regular", "professional"];

// discountValue is held in the form as the admin types it: a percent, or
// whole naira for fixed coupons. The API stores fixed amounts in kobo.
const EMPTY_FORM = {
  code: "",
  discountType: "percent" as CouponDiscountType,
  discountValue: 10,
  maxRedemptions: "",
  expiresAt: "",
  isActive: true,
  categories: [] as Category[],
};

function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function categoriesLabel(categories: Category[]): string {
  return categories.length === 0
    ? "All categories"
    : categories.map((c) => CATEGORY_LABELS[c]).join(", ");
}

function discountLabel(coupon: Coupon): string {
  if (coupon.discountType === "percent") {
    return coupon.discountValue === 100 ? "Free (100% off)" : `${coupon.discountValue}% off`;
  }
  return `₦${(coupon.discountValue / 100).toLocaleString("en-NG")} off`;
}

export default function AdminCouponsPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { coupons: list } = await listAdminCoupons(EVENT_SLUG);
        if (!cancelled) {
          setCoupons(list);
          setCouponsLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(describeError(err, "Failed to load coupons."));
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue:
        coupon.discountType === "fixed" ? coupon.discountValue / 100 : coupon.discountValue,
      maxRedemptions: coupon.maxRedemptions !== null ? String(coupon.maxRedemptions) : "",
      expiresAt: coupon.expiresAt ? toLocalInputValue(coupon.expiresAt) : "",
      isActive: coupon.isActive,
      categories: coupon.categories,
    });
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      const input = {
        code: form.code,
        discountType: form.discountType,
        discountValue:
          form.discountType === "fixed"
            ? Math.round(Number(form.discountValue) * 100)
            : Number(form.discountValue),
        maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
        expiresAt: form.expiresAt === "" ? null : new Date(form.expiresAt).toISOString(),
        isActive: form.isActive,
        categories: form.categories,
      };
      if (editingId) {
        await updateCoupon(editingId, input);
        toast.success(`${form.code} updated.`);
      } else {
        await createCoupon({ ...input, eventSlug: EVENT_SLUG });
        toast.success(`${form.code} created.`);
      }
      resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        describeError(err, `Failed to ${editingId ? "update" : "create"} coupon.`),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteCoupon(coupon.id);
      toast.success(`${coupon.code} removed.`);
      setDeleteConfirmId(null);
      if (editingId === coupon.id) resetForm();
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(describeError(err, "Failed to delete coupon."));
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Coupons</h1>
        <button
          onClick={startCreate}
          className="bg-coral text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral-deep transition-colors"
        >
          + Add coupon
        </button>
      </div>

      <FormModal open={formOpen} title={editingId ? "Edit coupon" : "New coupon"} onClose={resetForm}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Code</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. EARLYBIRD30"
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors uppercase"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Discount type</span>
            <select
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as CouponDiscountType })}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off (NGN)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">
              {form.discountType === "percent" ? "Discount (%) — 100 makes it free" : "Discount (NGN)"}
            </span>
            <input
              required
              type="number"
              min={1}
              max={form.discountType === "percent" ? 100 : undefined}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Max redemptions</span>
            <input
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              placeholder="Unlimited"
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Expires</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm text-sage mb-1">Valid for</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {COUPON_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-emerald"
                  checked={form.categories.includes(category)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      categories: e.target.checked
                        ? [...form.categories, category]
                        : form.categories.filter((c) => c !== category),
                    })
                  }
                />
                <span className="text-sm text-ink">{CATEGORY_LABELS[category]}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-sage">Leave all unticked to allow every category.</p>
        </fieldset>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-emerald"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span className="text-sm text-sage">Active</span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting ? (editingId ? "Saving…" : "Adding…") : editingId ? "Save changes" : "Add coupon"}
          </button>
          <button type="button" onClick={resetForm} className="text-sm text-sage">
            Cancel
          </button>
        </div>
      </form>
      </FormModal>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Categories</th>
              <th className="px-4 py-2">Redemptions</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!couponsLoaded && <TableRowsSkeleton rows={3} cols={7} />}
            {coupons.map((coupon) => (
              <Fragment key={coupon.id}>
                <tr className="border-b border-emerald/20 last:border-0">
                  <td className="px-4 py-2 font-mono">{coupon.code}</td>
                  <td className="px-4 py-2 text-sage">{discountLabel(coupon)}</td>
                  <td className="px-4 py-2 text-sage">{categoriesLabel(coupon.categories)}</td>
                  <td className="px-4 py-2 text-sage">
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-2 text-sage">
                    {coupon.expiresAt ? formatDateTime(coupon.expiresAt) : "Never"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full ${
                        coupon.isActive ? "bg-emerald/10 text-emerald" : "bg-emerald/5 text-sage"
                      }`}
                    >
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <button onClick={() => startEdit(coupon)} className="text-sm text-ink underline mr-3">
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(coupon.id)}
                      className="text-sm text-coral-deep underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === coupon.id && (
                  <tr className="border-b border-emerald/20 last:border-0">
                    <td colSpan={7} className="px-4 py-3 bg-coral/10">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">Delete {coupon.code}? This cannot be undone.</p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(coupon)}
                          className="bg-coral-deep text-white px-3 py-1 rounded-full text-sm hover:bg-gold-deep transition-colors disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-sage">
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
