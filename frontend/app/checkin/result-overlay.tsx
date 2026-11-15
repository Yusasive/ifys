import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import type { AttendeeSummary } from "@/lib/checkin-api";
import type { DisplayResult } from "./types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResultOverlay({
  result,
  onDismiss,
}: {
  result: DisplayResult;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      aria-label="Dismiss result"
      onKeyDown={onDismiss}
    >
      <ResultContent result={result} />
      <p className="fixed bottom-6 inset-x-0 z-[60] text-center text-xs uppercase tracking-widest text-white/70 pointer-events-none">
        Tap to continue
      </p>
    </div>
  );
}

// What door staff need to pick out the right name tag: the name big, then the
// role and organisation lines exactly as printed on the tag.
function AttendeeDetails({ attendee }: { attendee: AttendeeSummary }) {
  return (
    <>
      <h1 className="font-bricolage font-bold text-4xl sm:text-6xl mb-3 break-words max-w-full leading-tight">
        {attendee.fullName}
      </h1>
      {attendee.title && (
        <p className="text-xl sm:text-3xl font-semibold break-words max-w-full">
          {attendee.title}
        </p>
      )}
      {attendee.organization && (
        <p className="mt-1 text-lg sm:text-2xl opacity-90 break-words max-w-full">
          {attendee.organization}
        </p>
      )}
      <p className="mt-4 text-sm sm:text-lg uppercase tracking-widest opacity-80">
        {CATEGORY_LABELS[attendee.category] ?? attendee.category} ·{" "}
        {TIER_LABELS[attendee.tier] ?? attendee.tier}
      </p>
    </>
  );
}

function ResultContent({ result }: { result: DisplayResult }) {
  if (result.result === "valid_first_use") {
    return (
      <div className="fixed inset-0 bg-emerald flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#10003;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">
          Valid, first entry
        </p>
        <AttendeeDetails attendee={result.attendee} />
      </div>
    );
  }

  if (result.result === "recorded_offline") {
    return (
      <div className="fixed inset-0 bg-gold flex flex-col items-center justify-center text-center px-8 z-50 text-black">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#8635;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-70">
          Recorded, will sync
        </p>
        <AttendeeDetails attendee={result.attendee} />
      </div>
    );
  }

  if (result.result === "already_used") {
    return (
      <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#10007;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">
          Already used
        </p>
        <h1 className="font-bricolage font-semibold text-2xl sm:text-4xl mb-2 break-words max-w-full">
          {result.attendee.fullName}
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          First scanned at {formatTime(result.firstUsedAt)} ·{" "}
          {result.firstUsedStation}
        </p>
      </div>
    );
  }

  if (result.result === "already_used_offline") {
    return (
      <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#10007;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">
          Already used
        </p>
        <h1 className="font-bricolage font-semibold text-2xl sm:text-4xl mb-2 break-words max-w-full">
          {result.attendee.fullName}
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          Recorded locally. This station already checked them in.
        </p>
      </div>
    );
  }

  if (result.result === "offline_unavailable") {
    return (
      <div className="fixed inset-0 bg-gold flex flex-col items-center justify-center text-center px-8 z-50 text-black">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">!</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-70">
          Can&apos;t verify
        </p>
        <h1 className="font-bricolage font-semibold text-2xl sm:text-3xl">
          This device has no offline ticket list.
        </h1>
        <p className="mt-3 text-base sm:text-lg opacity-80">
          Reconnect to the internet to download it, or check this guest in at
          another station.
        </p>
      </div>
    );
  }

  if (result.result === "void") {
    return (
      <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#10007;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">
          Voided
        </p>
        <h1 className="font-bricolage font-semibold text-2xl sm:text-4xl mb-2 break-words max-w-full">
          {result.attendee.fullName}
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          This ticket was cancelled. Do not admit.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
      <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">&#10007;</div>
      <p className="text-sm uppercase tracking-widest mb-2 opacity-80">
        Not found
      </p>
      <h1 className="font-bricolage font-semibold text-2xl sm:text-3xl">
        No ticket matches this code.
      </h1>
    </div>
  );
}
