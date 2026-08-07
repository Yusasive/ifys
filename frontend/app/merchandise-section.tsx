"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const MERCH_ITEMS = [
  { src: "/merch/merch1.png", alt: "Islamic Finance Youth Summit tote bag" },
  { src: "/merch/merch2.png", alt: "Islamic Finance Youth Summit cap" },
  { src: "/merch/merch3.png", alt: "Islamic Finance Youth Summit t-shirt" },
];

function MerchCard({ item, delay }: { item: (typeof MERCH_ITEMS)[number]; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative aspect-square overflow-hidden group transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <Image
        src={item.src}
        alt={item.alt}
        fill
        sizes="(min-width: 640px) 33vw, 100vw"
        className="object-contain p-2 transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
      />
    </div>
  );
}

export function MerchandiseSection() {
  return (
    <section className="bg-white">
      <div className=" mx-auto px-4 lg:px-14 py-10 lg:py-16 text-center">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase mb-4">
          Summit Merchandise
        </p>
        <h2 className="font-bricolage font-medium text-3xl sm:text-[40px] leading-tight tracking-normal text-black mb-6">
          Take the Experience Home
        </h2>
        <p className="font-sans px-2 lg:px-4 font-normal text-md sm:text-2xl text-forest mb-12 sm:mb-14">
          Explore our exclusive collection of summit merchandise, thoughtfully designed to celebrate
          this year&apos;s event. Whether you&apos;re looking for practical essentials or memorable
          keepsakes, you&apos;ll be able to explore the collection and pick up your favourites at the
          summit venue.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10">
          {MERCH_ITEMS.map((item, i) => (
            <MerchCard key={item.src} item={item} delay={i * 120} />
          ))}
        </div>

        <p className="font-sans font-medium text-base sm:text-lg text-rust mb-6">And lots more....</p>
        <p className="font-bricolage font-semibold text-lg sm:text-xl text-forest">
          All Merchandise will be available at the Summit
        </p>
      </div>
    </section>
  );
}
