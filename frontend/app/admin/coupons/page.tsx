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
import { ApiError, CouponDiscountType } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { TableRowsSkeleton } from "../skeleton";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

const EMPTY_FORM = {
  code: "",
  discountType: "percent" as CouponDiscountType,
  discountValue: 10,
  maxRedemptions: "",
  expiresAt: "",
  isActive: true,
};

function discountLabel(coupon: Coupon): string {
  return coupon.discountType === "percent"
    ? `${coupon.discountValue}% off`
    : `₦${(coupon.discountValue / 100).toLocaleString("en-NG")} off`;
}

export default function AdminCouponsPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoaded, setCouponsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load coupons.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  function startEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxRedemptions: coupon.maxRedemptions !== null ? String(coupon.maxRedemptions) : "",
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
      isActive: coupon.isActive,
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    try {
      const input = {
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        maxRedemptions: form.maxRedemptions === "" ? undefined : Number(form.maxRedemptions),
        expiresAt: form.expiresAt === "" ? null : new Date(form.expiresAt).toISOString(),
        isActive: form.isActive,
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
        err instanceof ApiError ? err.body.message : `Failed to ${editingId ? "update" : "create"} coupon.`,
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
      toast.error(err instanceof ApiError ? err.body.message : "Failed to delete coupon.");
    } finally {
      setDeleting(false);
    }
  }

  if (authLoading || !session) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-line rounded-full px-4 py-1.5 text-sm text-ink hover:bg-paper-2 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Coupons</h1>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="border border-line rounded-2xl bg-white p-6 mb-8 flex flex-col gap-4 shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Code</span>
            <input
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="e.g. EARLYBIRD30"
              className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors uppercase"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Discount type</span>
            <select
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as CouponDiscountType })}
              className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount off (NGN)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">
              {form.discountType === "percent" ? "Discount (%)" : "Discount (NGN)"}
            </span>
            <input
              required
              type="number"
              min={1}
              max={form.discountType === "percent" ? 100 : undefined}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Max redemptions</span>
            <input
              type="number"
              min={1}
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              placeholder="Unlimited"
              className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Expires</span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="border border-line rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          <span className="text-sm text-muted">Active</span>
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {submitting ? (editingId ? "Saving…" : "Adding…") : editingId ? "Save changes" : "Add coupon"}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-sm text-muted">
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="border border-line rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Discount</th>
              <th className="px-4 py-2">Redemptions</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!couponsLoaded && <TableRowsSkeleton rows={3} cols={6} />}
            {coupons.map((coupon) => (
              <Fragment key={coupon.id}>
                <tr className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-mono">{coupon.code}</td>
                  <td className="px-4 py-2 text-muted">{discountLabel(coupon)}</td>
                  <td className="px-4 py-2 text-muted">
                    {coupon.redemptionCount}
                    {coupon.maxRedemptions !== null ? ` / ${coupon.maxRedemptions}` : ""}
                  </td>
                  <td className="px-4 py-2 text-muted">
                    {coupon.expiresAt ? formatDateTime(coupon.expiresAt) : "Never"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full ${
                        coupon.isActive ? "bg-emerald/10 text-emerald" : "bg-paper-2 text-muted"
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
                      className="text-sm text-rust underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === coupon.id && (
                  <tr className="border-b border-line last:border-0">
                    <td colSpan={6} className="px-4 py-3 bg-red-50">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">Delete {coupon.code}? This cannot be undone.</p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(coupon)}
                          className="bg-rust text-white px-3 py-1 rounded-full text-sm hover:bg-red-800 transition-colors disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)} className="text-sm text-muted">
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
