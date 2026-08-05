import { Sponsor } from "@/lib/api";

function LogoCard({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 w-[220px] sm:w-[280px] shrink-0">
      <div className="w-full aspect-[392/154] bg-white rounded-md flex items-center justify-center p-[10px] opacity-100">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="font-bricolage font-semibold text-sm sm:text-base text-ink/30 uppercase tracking-wide">
            Your Logo
          </span>
        )}
      </div>
      <p className="font-bricolage font-medium text-base sm:text-lg text-white">{name}</p>
    </div>
  );
}

function MarqueeRow({ items, direction }: { items: Sponsor[]; direction: "left" | "right" }) {
  const track = [...items, ...items];

  return (
    <div className="overflow-hidden">
      <div
        className={`flex w-max gap-6 sm:gap-8 ${
          direction === "left" ? "animate-marquee-left" : "animate-marquee-right"
        }`}
      >
        {track.map((item, i) => (
          <LogoCard key={`${item.id}-${i}`} name={item.name} logoUrl={item.logoUrl} />
        ))}
      </div>
    </div>
  );
}

export function SponsorsSection({ sponsors }: { sponsors: Sponsor[] }) {
  const sponsorEntries = sponsors.filter((s) => s.type === "sponsor");
  const partnerEntries = sponsors.filter((s) => s.type === "partner");

  if (sponsorEntries.length === 0 && partnerEntries.length === 0) return null;

  return (
    <section id="sponsors" className="bg-islamic-pattern">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 sm:pb-16 text-center">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase mb-4">
          Meet Our Sponsors and Partners
        </p>
        <h2 className="font-bricolage font-medium text-2xl sm:text-[40px] leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center">
          Backed by organisations building the ecosystem.
        </h2>
      </div>

      <div className="bg-forest py-14 sm:py-20 flex flex-col gap-10 sm:gap-12">
        {sponsorEntries.length > 0 && <MarqueeRow items={sponsorEntries} direction="right" />}
        {partnerEntries.length > 0 && <MarqueeRow items={partnerEntries} direction="left" />}
      </div>
    </section>
  );
}
