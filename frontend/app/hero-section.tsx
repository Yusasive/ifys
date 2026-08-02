import Image from "next/image";
import Link from "next/link";
import { StatsBar } from "./stats-bar";

export function HeroSection() {
  return (
    <section className="bg-islamic-pattern">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 text-center">
        <p className="font-plex font-normal text-lg sm:text-[24px] leading-none tracking-normal text-rust mb-5">
          ISLAMIC FINANCE YOUTH SUMMIT 2026
        </p>
        <h1 className="font-bricolage font-bold text-4xl sm:text-[64px] leading-none tracking-normal text-forest mb-6">
          The Ethical Generation: Rethinking Finance and Innovation.
        </h1>
        <p className="font-sans font-normal text-lg sm:text-[32px] leading-relaxed sm:leading-[48px] tracking-normal text-sage max-w-2xl sm:max-w-3xl mx-auto">
          A gathering of students, young professionals, founders, and industry leaders exploring
          the future of Islamic finance, innovation, and ethical leadership.
        </p>
      </div>

      <div>
        <div className="aspect-[1944/1291] w-full relative overflow-hidden">
          <Image
            src="/hero.png"
            alt="Skyscrapers, viewed from below"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-4 px-3">
            <Link
              href="/register"
              className="bg-coral text-white font-semibold text-xs sm:text-base px-3 sm:px-8 py-2 sm:py-3.5 rounded-full whitespace-nowrap hover:bg-coral-deep transition-colors"
            >
              Buy a Ticket
            </Link>
            <a
              href="#sponsors"
              className="bg-black/20 backdrop-blur-sm border border-white text-white font-semibold text-xs sm:text-base px-3 sm:px-8 py-2 sm:py-3.5 rounded-full whitespace-nowrap hover:bg-white hover:text-emerald transition-colors"
            >
              Become a Sponsor
            </a>
          </div>
        </div>
      </div>

      <StatsBar />
    </section>
  );
}
