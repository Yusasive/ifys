const SCHEDULE = [
  { time: "08:00", title: "Registration & Welcome" },
  { time: "09:00", title: "Opening Keynote: The Ethical Generation" },
  { time: "10:30", title: "Panel: Halal-First Innovation in Practice" },
  { time: "12:00", title: "Networking Lunch" },
  { time: "13:30", title: "Career Conversations & Mentorship Circles" },
  { time: "15:00", title: "Innovation Showcase" },
  { time: "16:30", title: "Closing Keynote & Charity Announcement" },
  { time: "17:30", title: "Networking Mixer" },
];

export function ScheduleSection() {
  return (
    <section id="schedule" className="bg-islamic-pattern">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-mono text-sm font-semibold tracking-widest text-coral-deep uppercase mb-3 text-center">
          Program Schedule
        </p>
        <h2 className="font-display text-xl lg:text-4xl text-emerald text-center mb-14">
          One day, from opening keynote to closing mixer.
        </h2>

        <ol className="relative border-l border-line pl-8 sm:pl-10">
          {SCHEDULE.map((item) => (
            <li key={item.time} className="mb-10 last:mb-0">
              <span className="absolute -left-[7px] mt-1.5 w-3.5 h-3.5 rounded-full bg-coral border-2 border-cloud" />
              <p className="font-mono text-xs font-semibold uppercase tracking-widest text-gold-deep mb-1">
                {item.time}
              </p>
              <p className="font-display text-xl text-emerald">{item.title}</p>
            </li>
          ))}
        </ol>

        <p className="text-sm text-emerald/50 text-center mt-4">
          Schedule is indicative and subject to change closer to the event.
        </p>
      </div>
    </section>
  );
}
