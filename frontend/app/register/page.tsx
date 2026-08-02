import { fetchTicketProducts } from "@/lib/api";
import { RegistrationWizard } from "./registration-wizard";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Ticket products (pricing, active tiers) are live backend state, not
// buildable at compile time — this page must be rendered per-request.
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const { event, ticketProducts } = await fetchTicketProducts(EVENT_SLUG);

  return (
    <main className="bg-islamic-pattern text-emerald flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-gold-deep uppercase mb-3">
          Islamic Finance Youth Summit 2026
        </p>
        <h1 className="font-display text-5xl sm:text-6xl italic text-emerald mb-10">
          Register your seat among the ethical generation.
        </h1>
        <RegistrationWizard eventSlug={event.slug} ticketProducts={ticketProducts} />
      </div>
    </main>
  );
}
