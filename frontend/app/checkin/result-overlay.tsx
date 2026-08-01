import type { ScanResult } from "@/lib/checkin-api";
import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResultOverlay({ result }: { result: ScanResult }) {
  if (result.result === "valid_first_use") {
    return (
      <div className="fixed inset-0 bg-emerald flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-8xl mb-6">&#10003;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">Valid — first entry</p>
        <h1 className="font-display text-4xl mb-2">{result.attendee.fullName}</h1>
        <p className="text-lg opacity-90">
          {CATEGORY_LABELS[result.attendee.category] ?? result.attendee.category} ·{" "}
          {TIER_LABELS[result.attendee.tier] ?? result.attendee.tier}
        </p>
      </div>
    );
  }

  if (result.result === "already_used") {
    return (
      <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-8xl mb-6">&#10007;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">Already used</p>
        <h1 className="font-display text-4xl mb-2">{result.attendee.fullName}</h1>
        <p className="text-lg opacity-90">
          First scanned at {formatTime(result.firstUsedAt)} · {result.firstUsedStation}
        </p>
      </div>
    );
  }

  if (result.result === "void") {
    return (
      <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
        <div className="text-8xl mb-6">&#10007;</div>
        <p className="text-sm uppercase tracking-widest mb-2 opacity-80">Voided</p>
        <h1 className="font-display text-4xl mb-2">{result.attendee.fullName}</h1>
        <p className="text-lg opacity-90">This ticket was cancelled — do not admit.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-red-700 flex flex-col items-center justify-center text-center px-8 z-50">
      <div className="text-8xl mb-6">&#10007;</div>
      <p className="text-sm uppercase tracking-widest mb-2 opacity-80">Not found</p>
      <h1 className="font-display text-3xl">No ticket matches this code.</h1>
    </div>
  );
}
