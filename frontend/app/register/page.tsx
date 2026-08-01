import { fetchTicketProducts } from "@/lib/api";
import { RegistrationWizard } from "./registration-wizard";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Ticket products (pricing, active tiers) are live backend state, not
// buildable at compile time — this page must be rendered per-request.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { event, ticketProducts } = await fetchTicketProducts(EVENT_SLUG);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-xs tracking-widest text-gold-light uppercase mb-3">
          {event.venue} · 7 Nov 2026
        </p>
        <h1 className="font-display text-3xl sm:text-4xl italic text-paper mb-10">
          Register your seat among the ethical generation.
        </h1>
        <RegistrationWizard eventSlug={event.slug} ticketProducts={ticketProducts} />
      </div>
    </main>
  );
}
