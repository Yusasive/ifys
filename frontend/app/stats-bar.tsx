"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: 10, suffix: "+", label: "Speakers" },
  { value: 300, suffix: "+", label: "Participants" },
  { value: 7, suffix: "+", label: "Sessions" },
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

  return (
    <p
      className={`font-bricolage font-medium text-[clamp(0.55rem,2.8vw,1.5rem)] sm:text-3xl xl:text-[48px] leading-none tracking-normal text-white whitespace-nowrap transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {count}
      {stat.suffix} {stat.label}
    </p>
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
    <div ref={ref} className="bg-salmon">
      <div className="w-full px-3 sm:px-8 py-6 sm:py-8 xl:h-[152px] flex flex-row flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-10 xl:gap-x-[150px] text-center">
        {STATS.map((stat, i) => (
          <Stat key={stat.label} stat={stat} active={visible} delay={i * 150} />
        ))}
      </div>
    </div>
  );
}
