"use client";

import { useRef, useState } from "react";
import {
  CouponValidation,
  ApiError,
  createCheckout,
  createRegistration,
  describeError,
  TicketProduct,
  validateCoupon,
} from "@/lib/api";
import { formatKobo, CATEGORY_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { insightsPayload, setServerErrors, setStep } from "@/lib/registration-slice";
import { readAttribution } from "@/lib/attribution";
import { tierPerks } from "@/lib/tier-perks";
import { BackButton } from "./back-button";

// Mirrors the backend's earlyBirdDiscountKobo so the total shown before a
// coupon is applied matches what checkout will charge.
function earlyBirdPriceKobo(product: TicketProduct): number {
  if (
    !product.discountPercent ||
    !product.discountExpiresAt ||
    new Date(product.discountExpiresAt).getTime() < Date.now()
  ) {
    return product.priceKobo;
  }
  return product.priceKobo - Math.round((product.priceKobo * product.discountPercent) / 100);
}

const FIELD_LABELS: Record<string, string> = {
  institution: "Institution",
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
  const createdRef = useRef<{ id: string; lookupToken: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [couponInput, setCouponInput] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);

  const product = ticketProducts.find(
    (p) => p.category === registration.category && p.tier === registration.tier,
  );
  const totalKobo = appliedCoupon
    ? appliedCoupon.finalPriceKobo
    : product
      ? earlyBirdPriceKobo(product)
      : null;
  const isFree = totalKobo === 0;

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
      setCouponError(describeError(err, "Couldn't validate that code."));
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
      // A retry after a failed checkout reuses the registration already
      // created, instead of creating a duplicate attendee and registration.
      const created = createdRef.current ?? (await createRegistration({
        eventSlug,
        category: registration.category,
        tier: registration.tier,
        fullName: registration.fullName,
        email: registration.email,
        phone: registration.phone,
        formData,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        ...insightsPayload(registration.insights),
        ...readAttribution(),
      }));
      createdRef.current = created;
      const { authorizationUrl } = await createCheckout(
        created.id,
        created.lookupToken,
      );
      window.location.href = authorizationUrl;
    } catch (err) {
      if (err instanceof ApiError && err.code === "FORM_INVALID" && err.fieldErrors) {
        // Send the user back to the fields the server rejected.
        dispatch(setServerErrors(err.fieldErrors));
        dispatch(setStep("details"));
        return;
      }
      setError(describeError(err));
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
      <h2 className="font-plex text-base sm:text-lg font-semibold uppercase tracking-[0.15em] text-forest text-center mb-2">
        Review Your Ticket
      </h2>

      <div className="border border-rust/30 rounded-[20px] p-5 sm:p-6 bg-white overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="font-sans font-semibold text-xl sm:text-2xl text-emerald break-words min-w-0">
            {registration.fullName}
          </div>
          <button
            type="button"
            onClick={() => dispatch(setStep("details"))}
            className="text-sm font-semibold text-rust underline shrink-0"
          >
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-y-1.5 text-base">
          {contactRows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-emerald/60 font-medium">{label}</dt>
              <dd className="text-emerald text-right break-all">{value}</dd>
            </div>
          ))}
        </dl>

        {detailRows.length > 0 && (
          <>
            <div className="border-t border-rust/20 my-4" />
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

      <div className="border border-rust/30 rounded-[20px] p-5 sm:p-6 bg-white overflow-hidden">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-sans font-semibold text-lg sm:text-xl text-emerald">
              {registration.category && CATEGORY_LABELS[registration.category]}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(setStep("category"))}
            className="text-sm font-semibold text-rust underline shrink-0"
          >
            Edit
          </button>
        </div>

        {registration.tier && (
          <ul className="text-base text-emerald/70 flex flex-col gap-1 mb-4">
            {tierPerks(registration.tier).map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <span className="text-rust mt-0.5">✓</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-rust/20 pt-3 flex flex-col gap-2">
          <label htmlFor="coupon-code" className="text-sm font-medium text-emerald/70">
            Coupon code (optional)
          </label>
          {appliedCoupon ? (
            <div className="flex items-center justify-between gap-3 bg-rust/10 border border-rust/40 rounded-full px-4 py-2.5">
              <span className="text-sm font-semibold text-rust break-words min-w-0">
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
                id="coupon-code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter code"
                aria-describedby={couponError ? "coupon-error" : undefined}
                aria-invalid={couponError ? true : undefined}
                className="flex-1 border border-rust/70 rounded-full px-4 py-2.5 text-sm text-emerald focus:outline-none focus:border-rust"
              />
              <button
                type="button"
                onClick={() => void handleApplyCoupon()}
                disabled={couponChecking || !couponInput.trim()}
                className="border border-rust/70 rounded-full px-5 py-2.5 text-sm font-semibold text-rust hover:bg-rust hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-rust"
              >
                {couponChecking ? "Checking…" : "Apply"}
              </button>
            </div>
          )}
          {couponError && (
            <p id="coupon-error" role="alert" className="text-sm text-red-600">
              {couponError}
            </p>
          )}
        </div>

        <div className="border-t border-rust/20 mt-3 pt-3 flex items-baseline justify-between">
          <span className="text-base font-medium text-emerald/70">Total</span>
          <span className="font-mono text-2xl font-semibold text-rust">
            {product && totalKobo !== null && formatKobo(totalKobo, product.currency)}
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-base text-red-600 border border-red-200 bg-red-50 rounded-sm px-3 py-2"
        >
          {error}
        </p>
      )}

      <p className="text-sm text-muted text-center">
        {isFree ? (
          "Your coupon covers the full price — no payment needed."
        ) : (
          <>
            You&apos;ll be redirected to Paystack to complete a secure payment
            {product && totalKobo !== null && ` of ${formatKobo(totalKobo, product.currency)}`}.
          </>
        )}
      </p>

      <div className="flex justify-between items-center">
        <BackButton onClick={() => dispatch(setStep("details"))} />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="bg-rust text-white font-semibold text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 rounded-full hover:bg-rust/90 transition-colors disabled:opacity-40"
        >
          {isFree
            ? submitting
              ? "Completing registration…"
              : "Complete registration"
            : submitting
              ? "Redirecting to payment…"
              : "Proceed to payment"}
        </button>
      </div>
    </div>
  );
}
