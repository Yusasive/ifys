"use client";

import { useEffect, useRef, useState } from "react";

const AGENDA: { time: string; title: string; detail?: string; kind?: "main" | "break" }[] = [
  { time: "9:00 AM – 10:00 AM", title: "Registration, Welcome Tea & Networking", kind: "break" },
  {
    time: "10:00 AM – 10:30 AM",
    title: "Opening Ceremony",
    detail: "Welcome Address & Opening Remarks",
  },
  {
    time: "10:30 AM – 11:10 AM",
    title: "Opening Keynote",
    detail: "The Ethical Generation: Rethinking Finance & Innovation",
  },
  { time: "11:10 AM – 12:10 PM", title: "Panel Session I" },
  { time: "12:10 PM – 1:10 PM", title: "Panel Session II" },
  { time: "1:10 PM – 2:00 PM", title: "Prayer, Lunch & Networking Break", kind: "break" },
  { time: "2:00 PM – 2:30 PM", title: "Interlude & Interactive Session", kind: "break" },
  { time: "2:30 PM – 3:20 PM", title: "Panel Session III" },
  { time: "3:20 PM – 4:00 PM", title: "Founder Spotlight" },
  { time: "4:00 PM – 4:15 PM", title: "Closing Remarks" },
  { time: "4:15 PM – 4:30 PM", title: "Group Photograph & Closing" },
];

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

function TimelineItem({
  item,
  right,
}: {
  item: (typeof AGENDA)[number];
  right: boolean;
}) {
  const [ref, seen] = useInView<HTMLLIElement>();
  const isBreak = item.kind === "break";
  const [start, end] = item.time.split(" – ");

  return (
    <li
      ref={ref}
      className="relative pl-10 md:pl-0 pb-8 last:pb-0 md:grid md:grid-cols-2 md:gap-14"
    >
      <span
        aria-hidden
        className={`absolute left-0 md:left-1/2 md:-translate-x-1/2 top-4 h-6 w-6 rounded-full border-4 border-white ring-2 motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out motion-safe:delay-150 ${
          isBreak ? "bg-white ring-coral-light" : "bg-coral ring-coral"
        } ${seen ? "scale-100 opacity-100" : "motion-safe:scale-0 motion-safe:opacity-0"}`}
      />
      <div
        className={`rounded-[16px] px-5 py-4 border motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out hover:-translate-y-1 hover:shadow-lg hover:border-coral ${
          isBreak
            ? "bg-paper-2 border-emerald/10"
            : "bg-white border-coral-light shadow-sm"
        } ${right ? "md:col-start-2" : "md:col-start-1 md:row-start-1 md:text-right"} ${
          seen
            ? "opacity-100 translate-x-0"
            : `motion-safe:opacity-0 ${right ? "motion-safe:md:translate-x-10" : "motion-safe:md:-translate-x-10"} motion-safe:translate-x-6`
        }`}
      >
        <p className="font-mono text-xs sm:text-sm font-semibold tracking-wide text-rust">
          {start} – {end}
        </p>
        <h3 className="font-display text-lg sm:text-xl text-emerald mt-1">
          {item.title}
        </h3>
        {item.detail && (
          <p className="text-sm sm:text-base text-emerald/70 italic mt-1">
            {item.detail}
          </p>
        )}
      </div>
    </li>
  );
}

export function ScheduleSection() {
  const [listRef, listSeen] = useInView<HTMLOListElement>(0.05);

  return (
    <section id="schedule" className="bg-white overflow-hidden">
      <div className="max-w-4xl mx-auto py-10 lg:py-6 px-4 sm:px-6">
        <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-rust uppercase mb-10 text-center">
          Program Schedule
        </p>
        <ol ref={listRef} className="relative">
          <span
            aria-hidden
            className={`absolute top-2 bottom-2 left-[11px] md:left-1/2 md:-translate-x-px w-0.5 origin-top bg-gradient-to-b from-coral-light via-coral to-rust motion-safe:transition-transform motion-safe:duration-[2000ms] motion-safe:ease-out ${
              listSeen ? "scale-y-100" : "motion-safe:scale-y-0"
            }`}
          />
          {AGENDA.map((item, i) => (
            <TimelineItem key={item.time} item={item} right={i % 2 === 0} />
          ))}
        </ol>
      </div>
    </section>
  );
}
