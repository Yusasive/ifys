import { ApiError } from "./api";

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

async function checkinRequest<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message: string;
    };
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export function scan(
  token: string,
  params: { qrToken?: string; shortCode?: string; stationId: string },
) {
  return checkinRequest<ScanResult>("/checkin/scan", token, {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function fetchCheckInStatus(token: string) {
  return checkinRequest<CheckInStatus>("/checkin/status", token);
}

export interface OfflineIndexEntry {
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

export function fetchOfflineIndex(token: string) {
  return checkinRequest<OfflineIndexEntry[]>("/checkin/offline-index", token);
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

export function syncScans(token: string, scans: QueuedScanPayload[]) {
  return checkinRequest<SyncScanResult[]>("/checkin/sync", token, {
    method: "POST",
    body: JSON.stringify({ scans }),
  });
}
