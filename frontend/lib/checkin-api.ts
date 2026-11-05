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
  | { result: "valid_first_use"; ticketId: string; attendee: AttendeeSummary };

export interface AttendeeSummary {
  fullName: string;
  category: string;
  tier: string;
  
  title?: string | null;
  organization?: string | null;
}

export interface CheckInStatusGroup {
  category: string;
  tier: string;
  checkedIn: number;
  total: number;
}

export interface CheckInStatus {
  // Void tickets are excluded from both numbers.
  checkedIn: number;
  totalTickets: number;
  groups: CheckInStatusGroup[];
}

export interface TicketSearchHit {
  ticketId: string;
  status: string;
  maskedEmail: string;
  attendee: AttendeeSummary;
}

async function checkinRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
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
  // Check-in from a name/email search result.
  ticketId?: string;
  stationId: string;
}) {
  return checkinRequest<ScanResult>("/checkin/scan", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function searchTickets(q: string) {
  return checkinRequest<TicketSearchHit[]>(`/checkin/search?q=${encodeURIComponent(q)}`);
}

export function undoCheckIn(ticketId: string) {
  return checkinRequest<{ ok: true }>("/checkin/undo", {
    method: "POST",
    body: JSON.stringify({ ticketId }),
  });
}

export function fetchCheckInStatus() {
  return checkinRequest<CheckInStatus>("/checkin/status");
}

export interface OfflineIndexEntry {
  ticketId: string;
  codeHash: string;
  qrHash: string;
  status: string;
  attendee: AttendeeSummary;
}

export interface OfflineIndexResponse {
  entries: OfflineIndexEntry[];
  syncedAt: string;
  // True when `entries` is the whole list rather than a delta.
  full: boolean;
}


export function fetchOfflineIndex(updatedSince?: string) {
  const query = updatedSince ? `?updatedSince=${encodeURIComponent(updatedSince)}` : "";
  return checkinRequest<OfflineIndexResponse>(`/checkin/offline-index${query}`);
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
  
  | { clientScanId: string; result: "invalid"; reason: string }
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
