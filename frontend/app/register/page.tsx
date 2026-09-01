import { fetchTicketProducts } from "@/lib/api";
import { RegistrationWizard } from "./registration-wizard";
import { RegisterBackButton } from "./register-back-button";
import { SiteFooter } from "../site-footer";
import { StatusCard } from "../status-card";
import { TicketsRemaining } from "../tickets-remaining";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Ticket products (pricing, active tiers) are live backend state, not
// buildable at compile time — this page must be rendered per-request.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { event, ticketProducts } = await fetchTicketProducts(EVENT_SLUG);

  return (
    <>
      <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 pt-24 pb-10 sm:pt-14 sm:pb-14">
        <RegisterBackButton className="lg:left-56" />
        <div className="w-full max-w-3xl">
          {!event.ticketPurchasingPaused && !event.soldOut && (
            <TicketsRemaining
              eventSlug={event.slug}
              initialSoldCount={event.ticketsSoldCount}
              initialCapacity={event.ticketCapacity}
            />
          )}
          {event.ticketPurchasingPaused ? (
            <StatusCard
              eyebrow="Registration"
              subheading="Ticket sales are paused"
              body="The form is not currently accepting applications. Please check back soon."
              icon="paused"
            />
          ) : event.soldOut ? (
            <StatusCard
              eyebrow="Registration"
              subheading="All tickets have been claimed"
              body={`All ${event.ticketCapacity} tickets for this event have been sold. Check back in case a spot opens up.`}
              icon="paused"
            />
          ) : (
            <RegistrationWizard eventSlug={event.slug} ticketProducts={ticketProducts} />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
