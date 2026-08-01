"use client";

import { useState } from "react";
import type { TicketProduct } from "@/lib/api";
import { useAppSelector } from "@/lib/hooks";
import { CategoryStep } from "./category-step";
import { TierStep } from "./tier-step";
import { DetailsStep } from "./details-step";
import { ReviewStep } from "./review-step";
import { PendingConfirmation } from "./pending-confirmation";
import { StepIndicator } from "./step-indicator";

export function RegistrationWizard({
  eventSlug,
  ticketProducts,
}: {
  eventSlug: string;
  ticketProducts: TicketProduct[];
}) {
  const step = useAppSelector((s) => s.registration.step);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  if (registrationId) {
    return <PendingConfirmation registrationId={registrationId} />;
  }

  return (
    <div>
      <StepIndicator current={step} />
      {step === "category" && <CategoryStep />}
      {step === "tier" && <TierStep ticketProducts={ticketProducts} />}
      {step === "details" && <DetailsStep />}
      {step === "review" && (
        <ReviewStep
          eventSlug={eventSlug}
          ticketProducts={ticketProducts}
          onSubmitted={setRegistrationId}
        />
      )}
    </div>
  );
}
