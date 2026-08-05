import { fetchTicketProducts, listSpeakers, listSponsors, Speaker, Sponsor, TicketProduct } from "@/lib/api";
import { SiteHeader } from "./site-header";
import { HeroSection } from "./hero-section";
import { AboutSection } from "./about-section";
import { SpeakersSection } from "./speakers-section";
import { ExperienceSection } from "./experience-section";
import { ScheduleSection } from "./schedule-section";
import { TicketsSection } from "./tickets-section";
import { SponsorsSection } from "./sponsors-section";
import { OrganizedBySection } from "./organized-by-section";
import { FaqSection } from "./faq-section";
import { NewsletterSection } from "./newsletter-section";
import { VenueSection } from "./venue-section";
import { SiteFooter } from "./site-footer";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Speakers are admin-managed live backend state (and photo URLs are
// short-lived signed S3 links), so this page must be rendered per-request
// rather than statically — same reasoning as app/register/page.tsx.
export const dynamic = "force-dynamic";

// Each loader degrades to an empty section on failure rather than taking
// the whole homepage down — but that degradation must not be silent, since
// the Tickets section disappearing (e.g. the backend is down) is a
// business-critical failure that needs to show up in server logs.
async function loadSpeakers(): Promise<Speaker[]> {
  try {
    const { speakers } = await listSpeakers(EVENT_SLUG);
    return speakers;
  } catch (err) {
    console.error("[home] failed to load speakers", err);
    return [];
  }
}

async function loadSponsors(): Promise<Sponsor[]> {
  try {
    const { sponsors } = await listSponsors(EVENT_SLUG);
    return sponsors;
  } catch (err) {
    console.error("[home] failed to load sponsors", err);
    return [];
  }
}

async function loadTicketProducts(): Promise<TicketProduct[]> {
  try {
    const { ticketProducts } = await fetchTicketProducts(EVENT_SLUG);
    return ticketProducts;
  } catch (err) {
    console.error("[home] failed to load ticket products", err);
    return [];
  }
}

export default async function Home() {
  const [speakers, sponsors, ticketProducts] = await Promise.all([
    loadSpeakers(),
    loadSponsors(),
    loadTicketProducts(),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <AboutSection />
        <SpeakersSection speakers={speakers} />
        <ExperienceSection />
        <ScheduleSection />
        <TicketsSection ticketProducts={ticketProducts} />
        <SponsorsSection sponsors={sponsors} />
        <OrganizedBySection />
        <FaqSection />
        <VenueSection />
        <NewsletterSection />
      </main>
      <SiteFooter />
    </div>
  );
}
