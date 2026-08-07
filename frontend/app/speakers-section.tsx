"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { Speaker } from "@/lib/api";

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`w-5 h-5 ${direction === "left" ? "rotate-180" : ""}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SpeakersSection({ speakers }: { speakers: Speaker[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  function getStep(el: HTMLDivElement) {
    const card = el.querySelector("[data-card]") as HTMLElement | null;
    return card ? card.offsetWidth + 32 : el.clientWidth * 0.8;
  }

  function scrollBy(direction: "left" | "right") {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -getStep(el) : getStep(el), behavior: "smooth" });
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = setInterval(() => {
      if (pausedRef.current) return;
      const step = getStep(el);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, 3000);

    const pause = () => (pausedRef.current = true);
    const resume = () => (pausedRef.current = false);
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume);

    return () => {
      clearInterval(interval);
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, []);

  if (speakers.length === 0) return null;

  return (
    <section id="speakers" className="bg-islamic-pattern">
      <div className="py-16 sm:py-24">
        <div className="mx-auto px-4 sm:px-6 text-center mb-12 sm:mb-14">
          <p className="font-plex text-lg lg:text-2xl font-normal leading-[48px] tracking-normal text-rust uppercase text-center mb-4">
            Meet Our Speakers
          </p>
          <h2 className="font-sans text-lg lg:text-[36px] font-normal leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center">
            A powerful lineup of speakers bringing experience, ideas, and insights to redefine the
            future of finance, innovation, and ethical impact.
          </h2>
        </div>

        <div
          ref={trackRef}
          className="no-scrollbar flex overflow-x-auto snap-x snap-mandatory gap-6 sm:gap-8 px-4 sm:px-6 lg:px-[max(1.5rem,calc((100vw-72rem)/2))] scroll-px-4 sm:scroll-px-6"
        >
          {speakers.map((speaker) => (
            <div
              key={speaker.id}
              data-card
              className="snap-start shrink-0 w-[260px] sm:w-[300px]"
            >
              <div className="speaker-card-frame rounded-2xl p-2.5 border border-line/60">
                <div className="aspect-square rounded-xl bg-ink/85 flex items-center justify-center overflow-hidden relative">
                  {speaker.photoUrl ? (
                    // unoptimized: photoUrl is a short-lived signed S3/R2
                    // URL (see sponsors-section.tsx for why the image
                    // proxy is skipped here).
                    <Image
                      src={speaker.photoUrl}
                      alt={speaker.name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <span className="font-bricolage font-bold text-7xl text-white/90">?</span>
                  )}
                </div>
              </div>
              <div className="mt-4 bg-coral rounded-xl py-3.5 text-center">
                <p className="font-bricolage font-bold text-sm sm:text-base uppercase tracking-wide text-white">
                  {speaker.tag}
                </p>
              </div>
              <p className="mt-4 font-bricolage font-medium text-base text-black text-center">
                {speaker.name}
              </p>
              <p className="mt-1 text-sm text-muted text-center">{speaker.role}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 mt-10 px-4">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            aria-label="Previous speaker"
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-rust hover:bg-coral hover:text-white hover:border-coral transition-colors"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            aria-label="Next speaker"
            className="w-10 h-10 rounded-full border border-line flex items-center justify-center text-rust hover:bg-coral hover:text-white hover:border-coral transition-colors"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>
      </div>
    </section>
  );
}
