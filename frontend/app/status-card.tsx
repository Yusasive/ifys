import { ReactNode } from "react";

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5 10 16l8-8" />
    </svg>
  );
}

export function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

function PausedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8v8M15 8v8" />
    </svg>
  );
}

export function StatusCard({
  eyebrow,
  subheading,
  body,
  icon,
  children,
}: {
  eyebrow: string;
  subheading: string;
  body?: string;
  icon: "check" | "error" | "paused" | "spinner";
  children?: ReactNode;
}) {
  return (
    <div className="text-center">
      <h1 className="font-plex text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal uppercase text-forest mb-4 sm:mb-6">
        {eyebrow}
      </h1>
      <p className="font-bricolage text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal text-black mb-6 sm:mb-8">
        {subheading}
      </p>

      <div className="w-full lg:w-[541px] lg:min-h-[421px] mx-auto bg-rust rounded-[10px] px-6 py-10 sm:px-10 lg:py-12 flex flex-col justify-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-full border-2 border-white text-white flex items-center justify-center shrink-0">
          {icon === "check" && <CheckIcon />}
          {icon === "error" && <ErrorIcon />}
          {icon === "paused" && <PausedIcon />}
          {icon === "spinner" && (
            <div
              className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
        {body && (
          <p className="font-sans text-base sm:text-2xl font-medium leading-snug sm:leading-[48px] tracking-normal text-center text-white max-w-sm mx-auto">
            {body}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
