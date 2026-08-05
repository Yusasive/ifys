"use client";

import { useEffect, useRef, useState } from "react";

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-7 h-7 sm:w-9 sm:h-9">
      <circle cx="10" cy="7" r="3.2" />
      <path strokeLinecap="round" d="M4 20c0-3.6 2.7-6 6-6s6 2.4 6 6" />
      <path strokeLinecap="round" d="M17 9.5c1.4.5 2.4 1.7 2.4 3.2M18.5 6.5c2 .6 3.5 2.5 3.5 4.8" />
    </svg>
  );
}

function ParticipantsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-7 h-7 sm:w-9 sm:h-9">
      <circle cx="8" cy="7" r="2.6" />
      <circle cx="16" cy="7" r="2.6" />
      <path strokeLinecap="round" d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path strokeLinecap="round" d="M13 14.3c2.6.3 4.5 2.4 4.5 4.7" />
      <path strokeLinecap="round" d="M2.5 19h11" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="w-7 h-7 sm:w-9 sm:h-9">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 15V9a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 15h18l-1.6 4.5a1 1 0 0 1-.94.5H5.54a1 1 0 0 1-.94-.5L3 15Z" />
      <circle cx="12" cy="4.5" r="1.4" />
      <path strokeLinecap="round" d="M12 5.9V8" />
    </svg>
  );
}

const STATS = [
  { value: 10, suffix: "+", label: "Speakers", Icon: SpeakerIcon },
  { value: 400, suffix: "+", label: "Participants", Icon: ParticipantsIcon },
  { value: 7, suffix: "+", label: "Sessions", Icon: SessionsIcon },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useCountUp(target: number, active: boolean, duration = 1200) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    const effectiveDuration = prefersReducedMotion() ? 0 : duration;
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = effectiveDuration === 0 ? 1 : Math.min((now - start) / effectiveDuration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);

  return count;
}

function Stat({ stat, active, delay }: { stat: (typeof STATS)[number]; active: boolean; delay: number }) {
  const count = useCountUp(stat.value, active);
  const { Icon } = stat;

  return (
    <div
      className={`flex flex-col items-center gap-2 sm:gap-3 transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <Icon />
      <p className="font-bricolage font-medium text-[clamp(0.85rem,3.6vw,1.75rem)] sm:text-3xl xl:text-[40px] leading-none tracking-normal text-white whitespace-nowrap">
        {count}
        {stat.suffix} {stat.label}
      </p>
    </div>
  );
}

export function StatsBar() {
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
    <section className="bg-white">
      <div className=" mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-10 sm:pb-14 text-center">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase mb-4">
          2026 Summit Target
        </p>
        <h2 className="font-bricolage font-medium text-2xl sm:text-[40px] leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center">
          Bringing together the right people, voices and conversations
        </h2>
      </div>

      <div ref={ref} className="bg-salmon">
        <div className="w-full max-w-5xl mx-auto px-3 sm:px-8 py-8 sm:py-10 xl:min-h-[172px] flex flex-row flex-wrap items-start justify-between gap-x-6 gap-y-6 text-center">
          {STATS.map((stat, i) => (
            <Stat key={stat.label} stat={stat} active={visible} delay={i * 150} />
          ))}
        </div>
      </div>
    </section>
  );
}
