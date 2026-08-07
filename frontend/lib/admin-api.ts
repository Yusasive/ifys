import {
  ApiError,
  Category,
  CouponDiscountType,
  Speaker,
  Sponsor,
  SponsorType,
  Tier,
  TicketProduct,
  VolunteerTeam,
} from "./api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// The CSRF token is handed to us once in the login/me response body and
// kept here in memory rather than read back out of a cookie — the API and
// the frontend can be served from different origins in production, and a
// cookie set by one origin isn't visible to document.cookie on another.
let csrfToken: string | null = null;

export type AdminRole = "organizer" | "door_staff" | "super_admin";
// Roles that can actually be assigned via POST /admin/users — super_admin
// accounts are seed/DB-only, never mintable through the API.
export type CreatableAdminRole = "organizer" | "door_staff";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

const SAFE_METHODS = new Set(["GET", "HEAD", undefined]);

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase();
  const tokenForRequest = SAFE_METHODS.has(method) ? null : csrfToken;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // Sends the httpOnly session cookie cross-origin (frontend/backend run
    // on different ports/hosts) — the auth token never touches JS.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(tokenForRequest ? { "X-CSRF-Token": tokenForRequest } : {}),
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

export async function login(email: string, password: string) {
  const result = await adminRequest<{ user: AdminUser; csrfToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  csrfToken = result.csrfToken;
  return { user: result.user };
}

export async function logout() {
  const result = await adminRequest<{ ok: true }>("/auth/logout", { method: "POST" });
  csrfToken = null;
  return result;
}

export async function fetchCurrentUser() {
  const result = await adminRequest<{ user: AdminUser; csrfToken: string }>("/auth/me");
  csrfToken = result.csrfToken;
  return { user: result.user };
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
  sortBy?: "createdAt" | "fullName" | "status";
  order?: "asc" | "desc";
}

export function fetchRegistrations(params: RegistrationsListParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    registrations: RegistrationListItem[];
  }>(`/admin/registrations?${query.toString()}`);
}

export interface CheckInRecord {
  id: string;
  stationId: string;
  checkedInAt: string;
  method: string;
}

export interface RegistrationDetail extends RegistrationListItem {
  formDataJson: Record<string, unknown>;
  studentIdFileUrl: string | null;
  studentIdSignedUrl: string | null;
  order: { status: string; amountKobo: number; paidAt: string | null } | null;
  ticket:
    | {
        ticketCode: string;
        status: string;
        qrSecret: string;
        issuedAt: string;
        checkIns: CheckInRecord[];
      }
    | null;
}

export function fetchRegistrationDetail(id: string) {
  return adminRequest<RegistrationDetail>(`/admin/registrations/${id}`);
}

export interface AdminStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byTier: Record<string, number>;
  ticketsIssued: number;
  checkedIn: number;
}

export function fetchStats() {
  return adminRequest<AdminStats>("/admin/stats");
}

export function markPaid(registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/mark-paid`, {
    method: "POST",
  });
}

export function resendTicket(registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/resend-ticket`, {
    method: "POST",
  });
}

export function voidTicket(registrationId: string, password: string) {
  return adminRequest(`/admin/registrations/${registrationId}/void`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export function requestExport() {
  return adminRequest<{ jobId: string }>("/admin/export", { method: "POST" });
}

export function getExportStatus(jobId: string) {
  return adminRequest<{ state: string; downloadUrl?: string }>(
    `/admin/export/${jobId}`,
  );
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  createdAt: string;
}

export function listNewsletterSubscribers() {
  return adminRequest<NewsletterSubscriber[]>("/admin/newsletter");
}

export function deleteNewsletterSubscriber(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/newsletter/${id}`, {
    method: "DELETE",
  });
}

export function requestNewsletterExport() {
  return adminRequest<{ jobId: string }>("/admin/newsletter/export", {
    method: "POST",
  });
}

export function getNewsletterExportStatus(jobId: string) {
  return adminRequest<{ state: string; downloadUrl?: string }>(
    `/admin/newsletter/export/${jobId}`,
  );
}

export interface AdminUserListItem extends AdminUser {
  createdAt: string;
}

export function listAdminUsers() {
  return adminRequest<{ users: AdminUserListItem[] }>("/admin/users");
}

export function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: CreatableAdminRole;
}) {
  return adminRequest<AdminUserListItem>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface SpeakerInput {
  name: string;
  role: string;
  tag?: string;
  bio?: string;
  photoKey?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export function listAdminSpeakers(eventSlug: string) {
  return adminRequest<{ speakers: Speaker[] }>(
    `/admin/speakers?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function createSpeaker(input: SpeakerInput & { eventSlug: string }) {
  return adminRequest<Speaker>("/admin/speakers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSpeaker(id: string, input: Partial<SpeakerInput>) {
  return adminRequest<Speaker>(`/admin/speakers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSpeaker(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/speakers/${id}`, {
    method: "DELETE",
  });
}

export function requestSpeakerPhotoUploadUrl(
  fileName: string,
  contentType: string,
) {
  return adminRequest<{ key: string; uploadUrl: string }>(
    "/admin/speakers/upload-url",
    { method: "POST", body: JSON.stringify({ fileName, contentType }) },
  );
}

export interface SponsorInput {
  type: SponsorType;
  name: string;
  websiteUrl?: string;
  logoKey?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export function listAdminSponsors(eventSlug: string) {
  return adminRequest<{ sponsors: Sponsor[] }>(
    `/admin/sponsors?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function createSponsor(input: SponsorInput & { eventSlug: string }) {
  return adminRequest<Sponsor>("/admin/sponsors", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateSponsor(id: string, input: Partial<SponsorInput>) {
  return adminRequest<Sponsor>(`/admin/sponsors/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSponsor(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/sponsors/${id}`, {
    method: "DELETE",
  });
}

export function requestSponsorLogoUploadUrl(
  fileName: string,
  contentType: string,
) {
  return adminRequest<{ key: string; uploadUrl: string }>(
    "/admin/sponsors/upload-url",
    { method: "POST", body: JSON.stringify({ fileName, contentType }) },
  );
}

export type SponsorApplicationStatus = "pending" | "approved" | "rejected";

export interface SponsorApplication {
  id: string;
  type: SponsorType;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  logoUrl: string | null;
  status: SponsorApplicationStatus;
  reviewedAt: string | null;
  sponsorId: string | null;
  createdAt: string;
}

export function listSponsorApplications(
  eventSlug: string,
  status?: SponsorApplicationStatus,
) {
  const query = new URLSearchParams({ event: eventSlug });
  if (status) query.set("status", status);
  return adminRequest<{ applications: SponsorApplication[] }>(
    `/admin/sponsor-applications?${query.toString()}`,
  );
}

export function approveSponsorApplication(id: string) {
  return adminRequest<Sponsor>(`/admin/sponsor-applications/${id}/approve`, {
    method: "POST",
  });
}

export function rejectSponsorApplication(id: string) {
  return adminRequest<SponsorApplication>(
    `/admin/sponsor-applications/${id}/reject`,
    { method: "POST" },
  );
}

export function listAdminTicketProducts(eventSlug: string) {
  return adminRequest<{ ticketProducts: TicketProduct[] }>(
    `/admin/ticket-products?event=${encodeURIComponent(eventSlug)}`,
  );
}

export interface UpdateTicketProductInput {
  priceKobo?: number;
  discountPercent?: number | null;
  discountExpiresAt?: string | null;
  cardPriceLabel?: string | null;
  cardNote?: string | null;
  isActive?: boolean;
}

export function updateTicketProduct(
  id: string,
  input: UpdateTicketProductInput,
) {
  return adminRequest<TicketProduct>(`/admin/ticket-products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export function listAdminCoupons(eventSlug: string) {
  return adminRequest<{ coupons: Coupon[] }>(
    `/admin/coupons?event=${encodeURIComponent(eventSlug)}`,
  );
}

export interface CouponInput {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxRedemptions?: number;
  expiresAt?: string | null;
  isActive?: boolean;
}

export function createCoupon(input: CouponInput & { eventSlug: string }) {
  return adminRequest<Coupon>("/admin/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCoupon(id: string, input: Partial<CouponInput>) {
  return adminRequest<Coupon>(`/admin/coupons/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCoupon(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/coupons/${id}`, {
    method: "DELETE",
  });
}

export type VolunteerApplicationStatus = "pending" | "approved" | "rejected";

export interface VolunteerApplicationFormData {
  location: string;
  willingToTravel: "yes" | "no" | "maybe";
  occupationalStatus: string;
  occupationalStatusOther?: string;
  aboutYourself: string;
  volunteeredBefore: boolean;
  volunteeredAreas?: string[];
  skills: string[];
  skillsOther?: string;
  team: VolunteerTeam;
  whyVolunteer: string;
  availabilityCommitment: "yes" | "no" | "maybe";
  timeCommitment: string;
  additionalComments?: string;
}

export interface VolunteerApplication {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  formDataJson: VolunteerApplicationFormData;
  status: VolunteerApplicationStatus;
  reviewedAt: string | null;
  createdAt: string;
}

export function listVolunteerApplications(
  eventSlug: string,
  status?: VolunteerApplicationStatus,
) {
  const query = new URLSearchParams({ event: eventSlug });
  if (status) query.set("status", status);
  return adminRequest<{ applications: VolunteerApplication[] }>(
    `/admin/volunteer-applications?${query.toString()}`,
  );
}

export function approveVolunteerApplication(id: string) {
  return adminRequest<VolunteerApplication>(
    `/admin/volunteer-applications/${id}/approve`,
    { method: "POST" },
  );
}

export function rejectVolunteerApplication(id: string) {
  return adminRequest<VolunteerApplication>(
    `/admin/volunteer-applications/${id}/reject`,
    { method: "POST" },
  );
}
