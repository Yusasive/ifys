const STEPS = [
  { label: "Keynote Sessions", tone: "emerald" as const },
  { label: "Innovation Showcase", tone: "coral" as const },
  { label: "Panel Discussions", tone: "emerald" as const },
  { label: "Career Conversations", tone: "coral" as const },
];

export function ExperienceSection() {
  return (
    <section className="bg-ink">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-mono text-sm font-semibold tracking-widest text-gold-light uppercase mb-3 text-center">
          Summit Experience
        </p>
        <h2 className="font-display text-3xl sm:text-4xl text-cloud text-center mb-14">
          Four moments, one journey through the day.
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3">
          {STEPS.map((step, i) => (
            <div key={step.label} className="flex-1 flex flex-col sm:flex-row items-center gap-4 sm:gap-3">
              <div
                className={`w-full sm:w-auto flex-1 rounded-full px-6 py-4 text-center font-display text-lg ${
                  step.tone === "coral" ? "bg-coral text-white" : "bg-emerald text-cloud"
                }`}
              >
                {step.label}
              </div>
              {i < STEPS.length - 1 && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="w-6 h-6 shrink-0 text-gold-light rotate-90 sm:rotate-0"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
