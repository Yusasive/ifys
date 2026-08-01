import { ApiError, Category, Tier } from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type AdminRole = "organizer" | "door_staff";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

async function adminRequest<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message: string;
      fieldErrors?: Record<string, string>;
    };
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return adminRequest<{ accessToken: string; user: AdminUser }>(
    "/auth/login",
    null,
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
}

export interface RegistrationListItem {
  id: string;
  status: string;
  createdAt: string;
  attendee: { fullName: string; email: string; phone: string };
  ticketProduct: { category: Category; tier: Tier; priceKobo: number; currency: string };
  ticket: { ticketCode: string; status: string } | null;
}

export interface RegistrationsListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  category?: string;
  tier?: string;
  search?: string;
}

export function fetchRegistrations(token: string, params: RegistrationsListParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    registrations: RegistrationListItem[];
  }>(`/admin/registrations?${query.toString()}`, token);
}

export interface RegistrationDetail extends RegistrationListItem {
  formDataJson: Record<string, unknown>;
  studentIdFileUrl: string | null;
  studentIdSignedUrl: string | null;
  order: { status: string; amountKobo: number; paidAt: string | null } | null;
  ticket:
    | ({ ticketCode: string; status: string; qrSecret: string; issuedAt: string } & {
        checkIns?: unknown[];
      })
    | null;
}

export function fetchRegistrationDetail(token: string, id: string) {
  return adminRequest<RegistrationDetail>(`/admin/registrations/${id}`, token);
}

export interface AdminStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  ticketsIssued: number;
  checkedIn: number;
}

export function fetchStats(token: string) {
  return adminRequest<AdminStats>("/admin/stats", token);
}

export function markPaid(token: string, registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/mark-paid`, token, {
    method: "POST",
  });
}

export function resendTicket(token: string, registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/resend-ticket`, token, {
    method: "POST",
  });
}

export function voidTicket(token: string, registrationId: string, password: string) {
  return adminRequest(`/admin/registrations/${registrationId}/void`, token, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function requestExport(token: string) {
  return adminRequest<{ jobId: string }>("/admin/export", token, { method: "POST" });
}

export function getExportStatus(token: string, jobId: string) {
  return adminRequest<{ state: string; downloadUrl?: string }>(
    `/admin/export/${jobId}`,
    token,
  );
}

export interface AdminUserListItem extends AdminUser {
  createdAt: string;
}

export function listAdminUsers(token: string) {
  return adminRequest<{ users: AdminUserListItem[] }>("/admin/users", token);
}

export function createAdminUser(
  token: string,
  input: { name: string; email: string; password: string; role: AdminRole },
) {
  return adminRequest<AdminUserListItem>("/admin/users", token, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
