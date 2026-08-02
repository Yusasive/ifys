"use client";

import type { TicketProduct } from "@/lib/api";
import { useAppSelector } from "@/lib/hooks";
import { CategoryStep } from "./category-step";
import { DetailsStep } from "./details-step";
import { ReviewStep } from "./review-step";
import { StepIndicator } from "./step-indicator";

export function RegistrationWizard({
  eventSlug,
  ticketProducts,
}: {
  eventSlug: string;
  ticketProducts: TicketProduct[];
}) {
  const step = useAppSelector((s) => s.registration.step);

  return (
    <div>
      <StepIndicator current={step} />
      {step === "category" && <CategoryStep ticketProducts={ticketProducts} />}
      {step === "details" && <DetailsStep />}
      {step === "review" && (
        <ReviewStep eventSlug={eventSlug} ticketProducts={ticketProducts} />
      )}
    </div>
  );
}
