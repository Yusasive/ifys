const SPEAKERS = [
  {
    name: "Prof. Abdulrazaq AbdulMajeed Alaro",
    role: "Professor of Islamic Law & Finance",
    tag: "Keynote Speaker",
    initials: "AA",
  },
  {
    name: "Ummuani Amin",
    role: "Managing Partner, The Metropolitan Law Firm",
    tag: "Speaker",
    initials: "UA",
  },
  {
    name: "Mudathir Adesanya",
    role: "Managing Director, IF Media Group",
    tag: "Speaker",
    initials: "MA",
  },
];

export function SpeakersSection() {
  return (
    <section id="speakers" className="bg-islamic-pattern">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-mono text-sm font-semibold tracking-widest text-coral-deep uppercase mb-3 text-center">
          Meet Our Speakers
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-emerald text-center max-w-2xl mx-auto mb-14">
          A powerful lineup of speakers bringing experience, ideas, and insights to redefine the
          future of finance, innovation, and ethical impact.
        </h2>

        <div className="grid sm:grid-cols-3 gap-8">
          {SPEAKERS.map((speaker) => (
            <div key={speaker.name} className="text-center">
              <div className="w-28 h-28 rounded-full bg-emerald mx-auto mb-5 flex items-center justify-center">
                <span className="font-display text-3xl text-gold-light">{speaker.initials}</span>
              </div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-coral-deep mb-2">
                {speaker.tag}
              </p>
              <p className="font-display text-xl text-emerald mb-1">{speaker.name}</p>
              <p className="text-sm text-emerald/60">{speaker.role}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
