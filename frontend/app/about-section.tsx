export function AboutSection() {
  return (
    <section id="about" className="bg-islamic-pattern">
      <div className="py-16 sm:py-24">
        <p className="font-plex text-xl lg:text-2xl font-normal leading-[48px] tracking-normal text-rust uppercase text-center mb-3">
          About the Summit
        </p>
        <h2 className="font-sans text-xl lg:text-[36px] font-normal text-black text-center mb-10">
          One stage for the builders defining what is next.
        </h2>

        {/* Two separate dark rectangles (not one shape) — offset from the
            left edge differently, with the map card overlapping the seam
            between them (negative margin pulls it up into the top card's
            bottom edge, and the bottom card's top padding gives it room
            to also sit over the map's lower half). */}
        <div className="bg-forest rounded-tl-[30px] ml-10 sm:ml-96  pt-10 sm:pt-16 pl-6 sm:pl-10 lg:pb-40 pr-6 sm:pr-8">
          <p className="text-cloud/90 text-base sm:text-xl leading-relaxed px-2 sm:px-8">
            The Islamic Finance Youth Summit brings together the ethical
            generation to challenge outdated thinking, explore halal-first
            innovation, and build the ideas, careers, and institutions that will
            define tomorrow&apos;s economy. This is where the new generation
            decides that ethical finance is no longer an alternative, it is the
            standard.
          </p>
        </div>

        <div className="relative mx-w-xs lg:max-w-lg mx-auto -mt-24 sm:-mt-32 z-10">
          <div className="bg-ink rounded-xl p-8 sm:p-10 relative overflow-hidden min-h-[400px] flex items-end shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
            {/* Sized ~130% and shifted -15% so the iframe's own edges
                (where Google anchors its logo, zoom controls, and the
                attribution bar) land outside this container's crop —
                the Maps Embed API has no dark-mode/style param, so this
                is the only way to hide that chrome from an <iframe>. */}
            <iframe
              src="https://maps.google.com/maps?q=8.481993,4.5771468&z=16&output=embed"
              className="absolute -top-[15%] -left-[15%] w-[130%] h-[130%] border-0 grayscale invert-[.92] sepia-[.25] hue-rotate-180 contrast-[.9] brightness-90"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ilorin Innovation Hub location"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/20 pointer-events-none" />
            <div className="relative flex flex-col items-center text-center gap-6 w-full">
              <div className="flex items-center gap-3">
                <p className="font-display text-4xl sm:text-5xl text-white font-black tracking-wide">
                  ILORIN
                </p>
              </div>
              <p className="font-mono text-2xl uppercase tracking-widest text-white ">
                Nigeria
              </p>
            </div>
          </div>
        </div>

        <div className="bg-forest rounded-br-[30px] mr-10 sm:mr-96  -mt-24 sm:-mt-76 pt-32 sm:pt-40 pb-6 sm:pb-8  pr-6 sm:pr-4">
          <p className="text-white text-base sm:text-xl leading-relaxed pt-40 text-center px-8 ">
            The world is entering a new era where artificial intelligence,
            digital finance, and innovation are redefining how wealth is created
            and opportunities are built. The question is no longer whether young
            people will shape that future, but whether they will shape it with
            values.
          </p>
        </div>
      </div>
    </section>
  );
}
