"use client";

import type { Category } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setCategory, setStep } from "@/lib/registration-slice";

const CATEGORIES: { value: Category; description: string }[] = [
  {
    value: "student",
    description: "Currently enrolled at a college or university.",
  },
  {
    value: "founder",
    description: "Building or leading an early-stage venture.",
  },
  {
    value: "professional",
    description: "Working in finance, tech, or an adjacent field.",
  },
];

export function CategoryStep() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.registration.category);

  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => {
            dispatch(setCategory(c.value));
            dispatch(setStep("tier"));
          }}
          className={`text-left border rounded-sm px-5 py-4 transition-colors ${
            selected === c.value
              ? "border-gold bg-ink-2"
              : "border-line hover:border-gold-light"
          }`}
        >
          <div className="font-display text-lg text-paper">
            {CATEGORY_LABELS[c.value]}
          </div>
          <div className="text-sm text-muted mt-1">{c.description}</div>
        </button>
      ))}
    </div>
  );
}
