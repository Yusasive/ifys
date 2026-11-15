import type { AttendeeSummary, ScanResult } from "@/lib/checkin-api";

export type DisplayResult =
  | ScanResult
  | {
      result: "recorded_offline";
      attendee: AttendeeSummary;
      // What undo needs to take the queued scan back.
      undo: { clientScanId: string; codeHash: string };
    }
  | { result: "already_used_offline"; attendee: AttendeeSummary }
  // Offline with no downloaded ticket list, so nothing can be verified.
  | { result: "offline_unavailable" };
