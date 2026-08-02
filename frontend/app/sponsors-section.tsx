const SPONSORS = [
  { label: "Sponsor" },
  { label: "Sponsor" },
  { label: "Sponsor" },
  { label: "Partner" },
  { label: "Partner" },
  { label: "Partner" },
];

export function SponsorsSection() {
  return (
    <section id="sponsors" className="bg-ink">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-mono text-sm font-semibold tracking-widest text-gold-light uppercase mb-3 text-center">
          Meet Our Sponsors and Partners
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-cloud text-center mb-14">
          Backed by organisations building the ecosystem.
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
          {SPONSORS.map((sponsor, i) => (
            <div
              key={i}
              className="border border-cloud/15 rounded-md py-10 flex flex-col items-center justify-center gap-2 text-cloud/40"
            >
              <span className="font-display text-lg">Your Logo</span>
              <span className="font-mono text-[10px] uppercase tracking-widest">{sponsor.label}</span>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="mailto:contact@ifysummit.com"
            className="inline-block border border-cloud/30 text-cloud font-semibold text-base px-10 py-3.5 rounded-sm hover:bg-cloud hover:text-ink transition-colors"
          >
            Become a Partner
          </a>
        </div>
      </div>
    </section>
  );
}
