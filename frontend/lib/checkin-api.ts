import { throwApiError } from "./http";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type ScanResult =
  | { result: "not_found" }
  | { result: "void"; attendee: AttendeeSummary }
  | {
      result: "already_used";
      attendee: AttendeeSummary;
      firstUsedAt: string;
      firstUsedStation: string;
    }
  | { result: "valid_first_use"; attendee: AttendeeSummary };

export interface AttendeeSummary {
  fullName: string;
  category: string;
  tier: string;
}

export interface CheckInStatus {
  checkedIn: number;
  totalTickets: number;
}

async function checkinRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // Sends the httpOnly session cookie — the door-staff device authorizes
    // the same way an admin browser tab does, no bearer token in JS.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) return throwApiError(res);
  return res.json() as Promise<T>;
}

export function scan(params: {
  qrToken?: string;
  shortCode?: string;
  stationId: string;
}) {
  return checkinRequest<ScanResult>("/checkin/scan", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function fetchCheckInStatus() {
  return checkinRequest<CheckInStatus>("/checkin/status");
}

export interface OfflineIndexEntry {
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

export function fetchOfflineIndex() {
  return checkinRequest<OfflineIndexEntry[]>("/checkin/offline-index");
}

export interface QueuedScanPayload {
  clientScanId: string;
  qrToken?: string;
  shortCode?: string;
  stationId: string;
  scannedAt: string;
}

export type SyncScanResult =
  | { clientScanId: string; result: "already_synced" }
  | { clientScanId: string; result: "not_found" }
  | { clientScanId: string; result: "void"; attendee: AttendeeSummary }
  | {
      clientScanId: string;
      result: "sync_conflict";
      attendee: AttendeeSummary;
      firstUsedAt: string;
      firstUsedStation: string;
    }
  | { clientScanId: string; result: "valid_first_use"; attendee: AttendeeSummary };

export function syncScans(scans: QueuedScanPayload[]) {
  return checkinRequest<SyncScanResult[]>("/checkin/sync", {
    method: "POST",
    body: JSON.stringify({ scans }),
  });
}
