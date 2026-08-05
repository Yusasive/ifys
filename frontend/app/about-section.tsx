export function AboutSection() {
  return (
    <section id="about" className="bg-islamic-pattern">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-plex text-2xl font-normal leading-[48px] tracking-normal text-rust uppercase text-center mb-3">
          About the Speakers
        </p>
        <h2 className="font-bricolage text-3xl sm:text-[40px] font-medium leading-[48px] tracking-normal text-black text-center mb-10">
          One stage for the builders defining what is next.
        </h2>

        <div className="bg-emerald rounded-tl-[120px] sm:rounded-tl-[160px] rounded-tr-3xl rounded-b-3xl pt-16 sm:pt-24 pl-10 sm:pl-16 pr-6 sm:pr-8 pb-6 sm:pb-8">
          <p className="text-cloud/90 text-base sm:text-lg leading-relaxed pr-2 sm:pr-4">
            The Islamic Finance Youth Summit brings together the ethical
            generation to challenge outdated thinking, explore halal-first
            innovation, and build the ideas, careers, and institutions that will
            define tomorrow&apos;s economy. This is where the new generation
            decides that ethical finance is no longer an alternative, it is the
            standard.
          </p>

          <div className="max-w-lg sm:max-w-xl mt-10">
            <div className="bg-ink rounded-tl-[48px] sm:rounded-tl-[64px] rounded-tr-3xl rounded-b-3xl p-8 sm:p-10 relative overflow-hidden min-h-[420px] flex items-end shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
              <iframe
                src="https://maps.google.com/maps?q=8.481993,4.5771468&z=16&output=embed"
                className="absolute inset-0 w-full h-full border-0 grayscale invert-[.92] contrast-[.85]"
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

          <p className="text-cloud/70 text-base sm:text-lg leading-relaxed mt-10 pr-2 sm:pr-4 text-center max-w-2xl mx-auto">
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
