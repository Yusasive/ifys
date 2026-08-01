import type { AttendeeSummary, ScanResult } from "@/lib/checkin-api";

// Local-only display states layered on top of the server's ScanResult —
// the offline path can show "recorded, will sync" (not yet server-
// confirmed) and an "already used" verdict reached purely from the
// local snapshot (no exact first-scan time/station available offline).
export type DisplayResult =
  | ScanResult
  | { result: "recorded_offline"; attendee: AttendeeSummary }
  | { result: "already_used_offline"; attendee: AttendeeSummary };
