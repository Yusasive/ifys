import { EventSummary, fetchTicketProducts, listSpeakers, listSponsors, Speaker, Sponsor, TicketProduct } from "@/lib/api";
import { SiteHeader } from "./site-header";
import { HeroSection } from "./hero-section";
import { CountdownSection } from "./countdown-section";
import { AboutSection } from "./about-section";
import { SpeakersSection } from "./speakers-section";
import { ExperienceSection } from "./experience-section";
import { ScheduleSection } from "./schedule-section";
import { TicketsSection } from "./tickets-section";
import { SponsorsSection } from "./sponsors-section";
import { OrganizedBySection } from "./organized-by-section";
import { MerchandiseSection } from "./merchandise-section";
import { FaqSection } from "./faq-section";
import { NewsletterSection } from "./newsletter-section";
import { VenueSection } from "./venue-section";
import { SiteFooter } from "./site-footer";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

export const dynamic = "force-dynamic";

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

async function loadTicketProducts(): Promise<{
  ticketProducts: TicketProduct[];
  event: EventSummary | null;
}> {
  try {
    return await fetchTicketProducts(EVENT_SLUG);
  } catch (err) {
    console.error("[home] failed to load ticket products", err);
    return { ticketProducts: [], event: null };
  }
}

export default async function Home() {
  const [speakers, sponsors, { ticketProducts, event }] = await Promise.all([
    loadSpeakers(),
    loadSponsors(),
    loadTicketProducts(),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <CountdownSection event={event} />
        <AboutSection />
        <SpeakersSection speakers={speakers} />
        <ExperienceSection />
        <ScheduleSection />
        <TicketsSection ticketProducts={ticketProducts} event={event} />
        <SponsorsSection sponsors={sponsors} />
        <OrganizedBySection />
        <MerchandiseSection />
        <VenueSection />
        <FaqSection />
        <NewsletterSection />
      </main>
      <SiteFooter />
    </div>
  );
}
