import Image from "next/image";

export function AboutSection() {
  return (
    <section id="about" className="bg-islamic-pattern">
      <div className="mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-plex text-xl lg:text-2xl font-normal leading-[48px] tracking-normal text-rust uppercase text-center mb-3">
          About the Summit
        </p>
        <h2 className="font-sans text-xl lg:text-[36px] font-normal text-black text-center mb-10">
          One stage for the builders defining what is next
        </h2>

        <div className="grid sm:grid-cols-2 gap-6 sm:gap-8 items-stretch">
          <div className="relative rounded-tl-[40px] rounded-2xl overflow-hidden aspect-[4/5] sm:aspect-auto">
            <Image
              src="/about.png"
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 640px) 448px, 100vw"
            />
          </div>

          <div className="border border-emerald rounded-2xl p-6 sm:p-8 flex items-center">
            <p className="font-sans font-normal text-base sm:text-2xl lg:text-[32px] leading-relaxed lg:leading-[50px] tracking-normal text-forest text-center">
              The Islamic Finance Youth Summit is bringing together the ethical
              generation to challenge outdated thinking, explore halal-first
              innovation, and build the ideas, careers, and institutions that
              will define tomorrow&apos;s economy. This is where the new
              generation decides that ethical finance is no longer an
              alternative, it is the standard.
            </p>
          </div>
        </div>

        <p className="font-sans font-normal text-base sm:text-2xl lg:text-[32px] leading-relaxed lg:leading-[48px] tracking-normal text-forest text-center  mx-auto mt-10">
          The world is entering a new era where artificial intelligence, digital
          finance, and innovation are redefining how wealth is created and
          opportunities are built. The question is no longer whether young
          people will shape that future but whether they will shape it with
          values.
        </p>
      </div>
    </section>
  );
}
