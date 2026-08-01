import type { WizardStep } from "@/lib/registration-slice";

const STEPS: { key: WizardStep; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "tier", label: "Tier" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
];

export function StepIndicator({ current }: { current: WizardStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 mb-8 font-mono text-xs uppercase tracking-widest">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex items-center gap-2">
          <span
            className={
              i <= currentIndex
                ? "text-gold-light"
                : "text-muted"
            }
          >
            {step.label}
          </span>
          {i < STEPS.length - 1 && <span className="text-line">—</span>}
        </li>
      ))}
    </ol>
  );
}
