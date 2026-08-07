"use client";

import type { TicketProduct } from "@/lib/api";
import { useAppSelector } from "@/lib/hooks";
import { CategoryStep } from "./category-step";
import { DetailsStep } from "./details-step";
import { ReviewStep } from "./review-step";

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
      {step === "category" && (
        <h1 className="font-plex text-base sm:text-lg font-semibold uppercase tracking-[0.15em] text-forest text-center mb-10 sm:mb-14">
          Ticketing/Registration
        </h1>
      )}
      {step === "category" && <CategoryStep ticketProducts={ticketProducts} />}
      {step === "details" && <DetailsStep />}
      {step === "review" && (
        <ReviewStep eventSlug={eventSlug} ticketProducts={ticketProducts} />
      )}
    </div>
  );
}
