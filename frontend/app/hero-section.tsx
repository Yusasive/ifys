import Image from "next/image";
import Link from "next/link";
import { StatsBar } from "./stats-bar";

export function HeroSection() {
  return (
    <section className="bg-islamic-pattern">
      <div className=" mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-14 text-center">
        <p className="font-plex font-normal text-lg sm:text-[24px] leading-none tracking-normal text-rust mb-5">
          ISLAMIC FINANCE YOUTH SUMMIT 2026
        </p>
        <p className="font-bricolage font-bold text-2xl sm:text-[32px] leading-none tracking-normal text-rust mb-3">
          THEME:
        </p>
        <h1 className="font-bricolage font-bold text-4xl sm:text-[64px] leading-none tracking-normal text-forest mb-6">
          The Ethical Generation: <br /> Rethinking Finance and Innovation
        </h1>
        <p className="font-sans font-normal text-lg sm:text-[32px] leading-relaxed sm:leading-[48px] tracking-normal text-sage max-w-2xl sm:max-w-3xl mx-auto">
          A gathering of ambitious young Africans building a future where ethical finance drives
          innovation, enterprise, and shared prosperity.
        </p>
      </div>

      <div>
        <div className="aspect-[1440/988] w-full relative overflow-hidden">
          <Image
            src="/hero.png"
            alt="Skyscrapers, viewed from below"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-100"
          />
          <div className="absolute inset-0 flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-[10px] px-3">
            <Link
              href="/register"
              className="flex items-center justify-center flex-1 lg:flex-none min-w-0 bg-salmon text-white font-sans font-medium text-xs sm:text-base lg:text-[28px] leading-none tracking-normal text-center px-3  py-2 sm:py-3.5 lg:w-[329px] lg:h-[60px] lg:p-4 rounded-full lg:rounded-[35px] whitespace-nowrap hover:bg-coral-deep transition-colors"
            >
              Buy a Ticket
            </Link>
            <Link
              href="/partner-with-us"
              className="flex items-center justify-center flex-1 lg:flex-none min-w-0 bg-transparent border border-salmon text-white font-sans font-medium text-xs sm:text-base lg:text-[28px] leading-none tracking-normal text-center px-3  py-2 sm:py-3.5 lg:w-[329px] lg:h-[60px] lg:p-4 rounded-full lg:rounded-[35px] whitespace-nowrap hover:bg-white hover:text-emerald transition-colors"
            >
              Become a Sponsor
            </Link>
          </div>
        </div>
      </div>

      <StatsBar />
    </section>
  );
}
