"use client";

import { useState } from "react";
import {
  ApiError,
  CouponValidation,
  createCheckout,
  createRegistration,
  TicketProduct,
  validateCoupon,
} from "@/lib/api";
import { formatKobo, CATEGORY_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setStep } from "@/lib/registration-slice";
import { tierPerks } from "@/lib/tier-perks";
import { BackButton } from "./back-button";

const FIELD_LABELS: Record<string, string> = {
  institution: "Institution",
  courseOfStudy: "Course of study",
  levelOrYear: "Level / year",
  startupName: "Startup / company name",
  organization: "Organization",
  role: "Role",
  industry: "Industry",
  linkedin: "LinkedIn",
};

export function ReviewStep({
  eventSlug,
  ticketProducts,
}: {
  eventSlug: string;
  ticketProducts: TicketProduct[];
}) {
  const dispatch = useAppDispatch();
  const registration = useAppSelector((s) => s.registration);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);

  const product = ticketProducts.find(
    (p) => p.category === registration.category && p.tier === registration.tier,
  );

  async function handleApplyCoupon() {
    if (!couponInput.trim() || !registration.category || !registration.tier) return;
    setCouponChecking(true);
    setCouponError(null);
    try {
      const result = await validateCoupon({
        eventSlug,
        code: couponInput.trim(),
        category: registration.category,
        tier: registration.tier,
      });
      setAppliedCoupon(result);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof ApiError ? err.body.message : "Couldn't validate that code.");
    } finally {
      setCouponChecking(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function handleSubmit() {
    if (!registration.category || !registration.tier) return;
    setSubmitting(true);
    setError(null);
    try {
      const formData = { ...registration.formData };
      if (registration.category === "student" && registration.studentIdFileKey) {
        formData.studentIdFileKey = registration.studentIdFileKey;
      }
      const created = await createRegistration({
        eventSlug,
        category: registration.category,
        tier: registration.tier,
        fullName: registration.fullName,
        email: registration.email,
        phone: registration.phone,
        formData,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      });
      // Server owns payment initialization end-to-end: it derives the
      // amount from the ticket product and builds the callback URL, so
      // the client only ever redirects — it never assembles anything
      // payment-related itself.
      const { authorizationUrl } = await createCheckout(
        created.id,
        created.lookupToken,
      );
      window.location.href = authorizationUrl;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  const contactRows: [string, string][] = [
    ["Email", registration.email],
    ["Phone", registration.phone],
  ];
  const detailRows = Object.entries(registration.formData)
    .filter(([key]) => key !== "studentIdFileKey")
    .map(([key, value]) => [FIELD_LABELS[key] ?? key, value] as [string, string]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-line rounded-sm p-5 bg-cloud">
        <div className="flex items-start justify-between mb-4">
          <div className="font-display text-2xl text-emerald">{registration.fullName}</div>
          <button
            type="button"
            onClick={() => dispatch(setStep("details"))}
            className="text-sm font-semibold text-gold-deep underline shrink-0"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-y-1.5 text-base">
          {contactRows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-emerald/60 font-medium">{label}</dt>
              <dd className="text-emerald text-right">{value}</dd>
            </div>
          ))}
        </dl>

        {detailRows.length > 0 && (
          <>
            <div className="border-t border-line my-4" />
            <dl className="grid grid-cols-2 gap-y-1.5 text-base">
              {detailRows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-emerald/60 font-medium">{label}</dt>
                  <dd className="text-emerald text-right break-all">{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>

      <div className="border border-line rounded-sm p-5 bg-cloud">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-display text-xl text-emerald">
              {registration.category && CATEGORY_LABELS[registration.category]}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(setStep("category"))}
            className="text-sm font-semibold text-gold-deep underline shrink-0"
          >
            Edit
          </button>
        </div>

        {registration.tier && (
          <ul className="text-base text-emerald/70 flex flex-col gap-1 mb-4">
            {tierPerks(registration.tier).map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <span className="text-gold-deep mt-0.5">✓</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line pt-3 flex flex-col gap-2">
          <span className="text-sm font-medium text-emerald/70">Coupon code (optional)</span>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-gold/10 border border-gold/40 rounded-sm px-3 py-2">
              <span className="text-sm font-semibold text-gold-deep">
                {appliedCoupon.code} applied — {formatKobo(appliedCoupon.discountKobo, product?.currency ?? "NGN")} off
              </span>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-sm text-emerald/60 underline shrink-0"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter code"
                className="flex-1 border border-line rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={() => void handleApplyCoupon()}
                disabled={couponChecking || !couponInput.trim()}
                className="border border-line rounded-sm px-4 py-2 text-sm font-semibold text-emerald disabled:opacity-40"
              >
                {couponChecking ? "Checking…" : "Apply"}
              </button>
            </div>
          )}
          {couponError && <p className="text-sm text-red-600">{couponError}</p>}
        </div>

        <div className="border-t border-line mt-3 pt-3 flex items-baseline justify-between">
          <span className="text-base font-medium text-emerald/70">Total</span>
          <span className="font-mono text-2xl font-semibold text-gold-deep">
            {product &&
              formatKobo(
                appliedCoupon ? appliedCoupon.finalPriceKobo : product.priceKobo,
                product.currency,
              )}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-base text-red-600 border border-red-200 bg-red-50 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <p className="text-sm text-muted text-center">
        You&apos;ll be redirected to Paystack to complete a secure payment
        {product &&
          ` of ${formatKobo(
            appliedCoupon ? appliedCoupon.finalPriceKobo : product.priceKobo,
            product.currency,
          )}`}
        .
      </p>

      <div className="flex justify-between items-center">
        <BackButton onClick={() => dispatch(setStep("details"))} />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="bg-gold text-ink font-semibold text-lg px-6 py-2 rounded-sm disabled:opacity-40"
        >
          {submitting ? "Redirecting to payment…" : "Proceed to payment"}
        </button>
      </div>
    </div>
  );
}
