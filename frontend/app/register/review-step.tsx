"use client";

import { useState } from "react";
import { ApiError, createCheckout, createRegistration, TicketProduct } from "@/lib/api";
import { formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setStep } from "@/lib/registration-slice";

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

  const product = ticketProducts.find(
    (p) => p.category === registration.category && p.tier === registration.tier,
  );

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
      });
      // Server owns payment initialization end-to-end: it derives the
      // amount from the ticket product and builds the callback URL, so
      // the client only ever redirects — it never assembles anything
      // payment-related itself.
      const { authorizationUrl } = await createCheckout(created.id);
      window.location.href = authorizationUrl;
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError("Something went wrong — please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border border-line rounded-sm p-5 bg-ink-2">
        <div className="font-display text-xl text-paper mb-1">{registration.fullName}</div>
        <div className="text-sm text-muted mb-4">{registration.email} · {registration.phone}</div>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted">Category</dt>
          <dd className="text-paper text-right">
            {registration.category && CATEGORY_LABELS[registration.category]}
          </dd>
          <dt className="text-muted">Tier</dt>
          <dd className="text-paper text-right">
            {registration.tier && TIER_LABELS[registration.tier]}
          </dd>
          <dt className="text-muted">Price</dt>
          <dd className="font-mono text-gold-light text-right">
            {product && formatKobo(product.priceKobo, product.currency)}
          </dd>
        </dl>
      </div>

      {error && (
        <p className="text-sm text-red-400 border border-red-900 rounded-sm px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => dispatch(setStep("details"))}
          className="text-muted text-sm hover:text-paper"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="bg-gold text-ink font-medium px-6 py-2 rounded-sm disabled:opacity-40"
        >
          {submitting ? "Redirecting to payment…" : "Proceed to payment"}
        </button>
      </div>
    </div>
  );
}
