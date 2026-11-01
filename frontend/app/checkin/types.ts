import type { AttendeeSummary, ScanResult } from "@/lib/checkin-api";

// Local-only display states layered on top of the server's ScanResult —
// the offline path can show "recorded, will sync" (not yet server-
// confirmed) and an "already used" verdict reached purely from the
// local snapshot (no exact first-scan time/station available offline).
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
