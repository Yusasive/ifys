"use client";

import { CATEGORY_LABELS } from "@/lib/format";
import { dismissSyncProblem, type SyncProblem } from "@/lib/offline-store";

const KIND_LABELS: Record<SyncProblem["kind"], string> = {
  conflict: "Already checked in elsewhere",
  void: "Ticket was voided",
  not_found: "Ticket not found",
  invalid: "Scan rejected",
};

const KIND_ADVICE: Record<SyncProblem["kind"], string> = {
  conflict: "This guest was admitted at two stations. Nothing to undo unless it looks like fraud.",
  void: "This guest was admitted offline but the ticket had been cancelled.",
  not_found: "This guest was admitted offline but the code matched no ticket.",
  invalid: "The server could not read this scan.",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}

// Offline check-ins the server didn't accept cleanly. They are stored on the
// device until dismissed, so a reload or a closed tab doesn't lose them.
export function ProblemsPanel({
  problems,
  onDismissed,
}: {
  problems: SyncProblem[];
  onDismissed: () => void;
}) {
  async function dismiss(id: string) {
    await dismissSyncProblem(id);
    onDismissed();
  }

  return (
    <ul className="mb-4 max-w-md mx-auto w-full flex flex-col gap-2">
      {problems.map((p) => (
        <li key={p.clientScanId} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold break-words">
                {p.attendee?.fullName ?? "Unknown guest"}
                {p.attendee && (
                  <span className="font-normal opacity-70">
                    {" "}
                    · {CATEGORY_LABELS[p.attendee.category] ?? p.attendee.category}
                  </span>
                )}
              </p>
              <p className="mt-0.5">{KIND_LABELS[p.kind]}</p>
              <p className="mt-0.5 opacity-80">
                Scanned here at {formatTime(p.scannedAt)}
                {p.firstUsedAt && p.firstUsedStation
                  ? ` · first admitted at ${formatTime(p.firstUsedAt)} (${p.firstUsedStation})`
                  : ""}
              </p>
              <p className="mt-1 text-xs opacity-70">{p.reason ?? KIND_ADVICE[p.kind]}</p>
            </div>
            <button
              type="button"
              onClick={() => void dismiss(p.clientScanId)}
              className="shrink-0 text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
