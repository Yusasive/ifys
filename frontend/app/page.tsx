import { SiteHeader } from "./site-header";
import { HeroSection } from "./hero-section";
import { AboutSection } from "./about-section";
import { SpeakersSection } from "./speakers-section";
import { ExperienceSection } from "./experience-section";
import { ScheduleSection } from "./schedule-section";
import { TicketsSection } from "./tickets-section";
import { SponsorsSection } from "./sponsors-section";
import { FaqSection } from "./faq-section";
import { SiteFooter } from "./site-footer";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <HeroSection />
        <AboutSection />
        <SpeakersSection />
        <ExperienceSection />
        <ScheduleSection />
        <TicketsSection />
        <SponsorsSection />
        <FaqSection />
      </main>
      <SiteFooter />
    </div>
  );
}
