import Image from "next/image";

function PinIcon() {
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-salmon flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 sm:w-7 sm:h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.5s7-6.2 7-12.2a7 7 0 1 0-14 0c0 6 7 12.2 7 12.2Z" />
        <circle cx="12" cy="9.3" r="2.6" />
      </svg>
    </div>
  );
}

function CalendarIcon() {
  return (
    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-salmon flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 sm:w-7 sm:h-7">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    </div>
  );
}

export function VenueSection() {
  return (
    <section className="bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 lg:py-16 text-center">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase">
          Venue and Date
        </p>
      </div>

      <div className="relative w-full min-h-[560px] sm:min-h-0 sm:aspect-[1440/1080] overflow-hidden">
        <Image
          src="/location-bg.png"
          alt="Ilorin Innovation Hub, Multipurpose Hall"
          fill
          sizes="100vw"
          className="object-cover opacity-100"
          style={{ top: -10 }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-between gap-6 py-10 lg:py-14 px-4 text-center">
          <div className="flex flex-col items-center gap-2 sm:gap-3 text-forest">
            <PinIcon />
            <p className="font-sans font-bold text-base sm:text-[32px] lg:leading-[1.2] lg:leading-[48px] tracking-normal text-center">
              Ilorin Innovation Hub,
              <br />
              Multipurpose Hall
            </p>
            <p className="font-sans font-bold text-xl sm:text-[48px] leading-[1.1] sm:leading-[48px] tracking-normal text-center uppercase">
              Ilorin, Nigeria
            </p>
            <a
              href="https://maps.google.com/maps?q=8.481993,4.5771468"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center justify-center rounded-full bg-salmon px-6 sm:px-8 py-2 sm:py-3 font-sans font-medium text-base sm:text-2xl leading-tight sm:leading-[50px] tracking-normal text-center text-white hover:bg-salmon/90 transition-colors"
            >
              View on Map
            </a>
          </div>

          <div className="flex flex-col items-center gap-2 sm:gap-3 text-white">
            <CalendarIcon />
            <p className="font-sans font-bold text-lg sm:text-[48px] leading-[1.2] sm:leading-[48px] tracking-normal text-center max-w-xs sm:max-w-none">
              Saturday, 7th of November, <br /> 2026
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
