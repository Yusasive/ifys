import type { WizardStep } from "@/lib/registration-slice";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
];

export function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-start mb-10">
      {STEPS.map((step, i) => {
        const completed = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step.key} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center font-mono text-sm font-semibold ${
                  completed
                    ? "bg-gold border-gold text-ink"
                    : active
                      ? "border-gold-deep text-gold-deep"
                      : "border-line text-muted"
                }`}
              >
                {completed ? "✓" : i + 1}
              </div>
              <span
                className={`font-mono text-xs font-semibold uppercase tracking-widest whitespace-nowrap ${
                  active || completed ? "text-gold-deep" : "text-emerald/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 mb-4 ${completed ? "bg-gold" : "bg-line"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
