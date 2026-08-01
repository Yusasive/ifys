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
