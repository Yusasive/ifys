"use client";

import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setStep, WizardStep } from "@/lib/registration-slice";

const STEP_ORDER: WizardStep[] = ["category", "details", "review"];

// The registration form is one page with three client-rendered steps, not
// three routes — so the corner back arrow must step back through the
// wizard (category <- details <- review) rather than always doing a
// browser-history back, which would leave the form entirely (e.g. to the
// homepage) even when the user just meant "previous screen."
export function RegisterBackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const step = useAppSelector((s) => s.registration.step);

  function handleClick() {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) {
      dispatch(setStep(STEP_ORDER[index - 1]));
      return;
    }
    // Already on the first step — there's no previous screen within the
    // wizard, so leaving the page via browser history is the right call.
    router.back();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Go back"
      className={`absolute top-4 left-4 lg:top-6 flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 shrink-0 rounded-full border border-black text-black hover:bg-black hover:text-white transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 sm:w-5 sm:h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
