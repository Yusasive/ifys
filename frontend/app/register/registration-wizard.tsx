"use client";

import type { EventSummary, TicketProduct } from "@/lib/api";
import { useAppSelector } from "@/lib/hooks";
import { useTicketAvailability } from "@/lib/use-ticket-availability";
import { TicketsRemaining } from "../tickets-remaining";
import { CategoryStep } from "./category-step";
import { DetailsStep } from "./details-step";
import { ReviewStep } from "./review-step";

export function RegistrationWizard({
  event,
  ticketProducts,
}: {
  event: EventSummary;
  ticketProducts: TicketProduct[];
}) {
  const step = useAppSelector((s) => s.registration.step);
  const category = useAppSelector((s) => s.registration.category);
  const availability = useTicketAvailability(event);

  return (
    <div>
      {/* Total across categories while choosing; once a category is picked,
          only that category's count. */}
      <TicketsRemaining event={event} category={step === "category" ? null : category} />
      {step === "category" && (
        <h1 className="font-plex text-base sm:text-lg font-semibold uppercase tracking-[0.15em] text-forest text-center mb-10 sm:mb-14">
          Ticketing/Registration
        </h1>
      )}
      {step === "category" && (
        <CategoryStep ticketProducts={ticketProducts} availability={availability} />
      )}
      {step === "details" && <DetailsStep />}
      {step === "review" && (
        <ReviewStep eventSlug={event.slug} ticketProducts={ticketProducts} />
      )}
    </div>
  );
}
