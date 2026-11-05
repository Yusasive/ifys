import {
  CategoryAvailability,
  Category,
  CouponDiscountType,
  Speaker,
  Sponsor,
  SponsorType,
  Tier,
  TicketProduct,
  VolunteerTeam,
} from "./api";
import { throwApiError } from "./http";
import { PermissionKey } from "./permissions";

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
  mustChangePassword: boolean;
  notifyOnStudentRegistration: boolean;
  permissions: PermissionKey[];
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
  if (!res.ok) return throwApiError(res);
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

export async function changePassword(currentPassword: string, newPassword: string) {
  const result = await adminRequest<{ user: AdminUser; csrfToken: string }>(
    "/auth/change-password",
    { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
  );
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
  order: { status: string; paymentChannel: string | null; amountMinor: number } | null;
  coupon: { code: string } | null;
  discountAppliedKobo: number;
  // Analysis fields collected at registration (null on older registrations).
  heardFrom: string | null;
  state: string | null;
  industry: string | null;
  utmCampaign: string | null;
}

export interface RegistrationsListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  category?: string;
  tier?: string;
  search?: string;
  // Registered between these moments (ISO timestamps).
  from?: string;
  to?: string;
  source?: string;
  coupon?: string;
  channel?: string;
  sortBy?: "createdAt" | "fullName" | "status" | "amount";
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

export interface RegistrationDetail extends Omit<RegistrationListItem, "order"> {
  formDataJson: Record<string, unknown>;
  gender: string | null;
  ageRange: string | null;
  attendReason: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  referrer: string | null;
  studentIdFileUrl: string | null;
  studentIdSignedUrl: string | null;
  order: { status: string; amountKobo: number; paidAt: string | null; paymentChannel: string | null } | null;
  cancellationReason: string | null;
  pendingPaymentReminderSentAt: string | null;
  ticket:
    | {
        ticketCode: string;
        status: string;
        qrSecret: string;
        issuedAt: string;
        checkIns: CheckInRecord[];
        lastActionType: "reissued" | "voided" | "restored" | "withdrawn" | null;
        lastActionReason: string | null;
        lastActionAt: string | null;
      }
    | null;
}

export function fetchRegistrationDetail(id: string) {
  return adminRequest<RegistrationDetail>(`/admin/registrations/${id}`);
}

export interface BreakdownItem {
  label: string;
  count: number;
  paid: number;
}

// See backend admin-analytics.ts. Money is in minor units (kobo).
export interface AdminAnalytics {
  asOf: string;
  timeZone: string;
  funnel: {
    registered: number;
    paid: number;
    pendingPayment: number;
    pendingReview: number;
    failedOrCancelled: number;
    conversionRate: number;
  };
  pending: {
    count: number;
    under24h: number;
    between1And3Days: number;
    over3Days: number;
    remindable: number;
  };
  daily: { date: string; total: number; paid: number; pending: number }[];
  revenue: {
    currency: string;
    totalMinor: number;
    discountMinor: number;
    byProduct: { category: string; tier: string; count: number; amountMinor: number }[];
    byChannel: { channel: string; count: number; amountMinor: number }[];
  };
  coupons: { code: string; count: number; discountMinor: number }[];
  breakdowns: {
    category: BreakdownItem[];
    tier: BreakdownItem[];
    industry: BreakdownItem[];
    source: BreakdownItem[];
    campaign: BreakdownItem[];
    state: BreakdownItem[];
    gender: BreakdownItem[];
    ageRange: BreakdownItem[];
  };
  eventDay: {
    tickets: number;
    checkedIn: number;
    checkInRate: number;
    arrivalsByHour: { hour: string; count: number }[];
    byStation: { station: string; count: number }[];
    noShowByCategory: { category: string; tickets: number; checkedIn: number; noShow: number }[];
  };
  flags: { sharedEmailDomains: { domain: string; count: number }[] };
}

export function fetchAnalytics() {
  return adminRequest<AdminAnalytics>("/admin/analytics");
}

// Emails a reminder to everyone pending for at least `olderThanHours` who
// hasn't been reminded in the last 24 hours.
export function remindPendingPayments(olderThanHours = 24) {
  return adminRequest<{ queued: number }>("/admin/registrations/remind-pending", {
    method: "POST",
    body: JSON.stringify({ olderThanHours }),
  });
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

export function markPaid(registrationId: string, reason: string) {
  return adminRequest(`/admin/registrations/${registrationId}/mark-paid`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function changeAttendeeEmail(registrationId: string, email: string, reason: string) {
  return adminRequest<{ email: string }>(`/admin/registrations/${registrationId}/email`, {
    method: "PATCH",
    body: JSON.stringify({ email, reason }),
  });
}

export function resendTicket(registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/resend-ticket`, {
    method: "POST",
  });
}

export interface DateUpdateResendStatus {
  eventStartsAt: string;
  totalTickets: number;
  alreadySent: number;
  pending: number;
  lastSentAt: string | null;
}

export type TicketEmailKind = "ticket" | "date_update" | "whatsapp_invite";

// "broadcast" (WhatsApp invite only): got the link in an earlier hand-sent
// WhatsApp broadcast from the Messages page.
export type TicketEmailDeliveryStatus =
  | "sent"
  | "failed"
  | "queued"
  | "untracked"
  | "not_sent"
  | "broadcast";

export interface TicketEmailDeliveryRow {
  ticketId: string;
  registrationId: string;
  ticketCode: string;
  fullName: string;
  email: string;
  status: TicketEmailDeliveryStatus;
  error: string | null;
  sentAt: string | null;
  updatedAt: string | null;
}

export interface TicketEmailDeliveries {
  total: number;
  summary: Record<TicketEmailDeliveryStatus, number>;
  rows: TicketEmailDeliveryRow[];
}

export function getTicketEmailDeliveries(eventSlug: string, kind: TicketEmailKind) {
  return adminRequest<TicketEmailDeliveries>(
    `/admin/tickets/email-deliveries?event=${encodeURIComponent(eventSlug)}&kind=${kind}`,
  );
}

// Without ticketIds, resends to everyone whose email of this kind failed
// (for the WhatsApp invite: everyone who hasn't got it yet).
export function resendTicketEmails(eventSlug: string, kind: TicketEmailKind, ticketIds?: string[]) {
  return adminRequest<{ queued: number }>(
    `/admin/tickets/email-deliveries/resend?event=${encodeURIComponent(eventSlug)}`,
    { method: "POST", body: JSON.stringify({ kind, ticketIds }) },
  );
}

export function getDateUpdateResendStatus(eventSlug: string) {
  return adminRequest<DateUpdateResendStatus>(
    `/admin/tickets/date-update-resend?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function sendDateUpdateResend(eventSlug: string, password: string) {
  return adminRequest<{ queued: number }>(
    `/admin/tickets/date-update-resend?event=${encodeURIComponent(eventSlug)}`,
    { method: "POST", body: JSON.stringify({ password }) },
  );
}

export function voidTicket(
  registrationId: string,
  reason: string,
  password: string,
) {
  return adminRequest(`/admin/registrations/${registrationId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason, password }),
  });
}

export function reissueTicket(registrationId: string, reason: string) {
  return adminRequest(
    `/admin/registrations/${registrationId}/reissue-ticket`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function restoreTicket(registrationId: string, reason: string) {
  return adminRequest(
    `/admin/registrations/${registrationId}/restore-ticket`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function withdrawTicket(
  registrationId: string,
  reason: string,
  password: string,
) {
  return adminRequest(
    `/admin/registrations/${registrationId}/withdraw-ticket`,
    { method: "POST", body: JSON.stringify({ reason, password }) },
  );
}

export function cancelRegistration(
  registrationId: string,
  reason: string,
  password: string,
) {
  return adminRequest(`/admin/registrations/${registrationId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason, password }),
  });
}

export function approveStudentRegistration(registrationId: string) {
  return adminRequest(
    `/admin/registrations/${registrationId}/approve-student`,
    { method: "POST" },
  );
}

export function rejectStudentRegistration(
  registrationId: string,
  reason: string,
  password: string,
) {
  return adminRequest(
    `/admin/registrations/${registrationId}/reject-student`,
    { method: "POST", body: JSON.stringify({ reason, password }) },
  );
}

export function sendPendingPaymentReminder(registrationId: string) {
  return adminRequest(`/admin/registrations/${registrationId}/send-reminder`, {
    method: "POST",
  });
}

export interface BroadcastAudience {
  registrationIds?: string[];
  categories?: Category[];
  tiers?: Tier[];
  statuses?: string[];
}

export interface BroadcastContent {
  subject: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export interface EmailBroadcast {
  id: string;
  subject: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  audienceJson: BroadcastAudience;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  createdByName: string | null;
}

// The automatic "join the WhatsApp group" email sent with every new
// ticket while whatsappGroupUrl is set.
export interface WhatsAppInviteSettings {
  whatsappGroupUrl: string | null;
  subject: string;
  bodyHtml: string;
  ctaLabel: string;
}

export function getWhatsAppInvite(eventSlug: string) {
  return adminRequest<WhatsAppInviteSettings>(
    `/admin/broadcasts/whatsapp-invite?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function updateWhatsAppInvite(eventSlug: string, whatsappGroupUrl: string | null) {
  return adminRequest<WhatsAppInviteSettings>("/admin/broadcasts/whatsapp-invite", {
    method: "PUT",
    body: JSON.stringify({ eventSlug, whatsappGroupUrl }),
  });
}

export function listBroadcasts(eventSlug: string) {
  return adminRequest<EmailBroadcast[]>(
    `/admin/broadcasts?event=${encodeURIComponent(eventSlug)}`,
  );
}

export interface BroadcastFailure {
  email: string;
  fullName: string;
  error: string;
  failedAt: string;
}

export function listBroadcastFailures(broadcastId: string) {
  return adminRequest<BroadcastFailure[]>(`/admin/broadcasts/${broadcastId}/failures`);
}

export function resendFailedBroadcast(broadcastId: string) {
  return adminRequest<{ recipientCount: number }>(
    `/admin/broadcasts/${broadcastId}/resend-failed`,
    { method: "POST" },
  );
}

export function previewBroadcastAudience(eventSlug: string, audience: BroadcastAudience) {
  return adminRequest<{ count: number; sample: { email: string; fullName: string }[] }>(
    "/admin/broadcasts/audience-preview",
    { method: "POST", body: JSON.stringify({ eventSlug, audience }) },
  );
}

export function renderBroadcastPreview(eventSlug: string, content: BroadcastContent) {
  return adminRequest<{ html: string }>("/admin/broadcasts/preview", {
    method: "POST",
    body: JSON.stringify({ eventSlug, ...content }),
  });
}

export function sendTestBroadcast(eventSlug: string, content: BroadcastContent) {
  return adminRequest<{ sentTo: string }>("/admin/broadcasts/test", {
    method: "POST",
    body: JSON.stringify({ eventSlug, ...content }),
  });
}

export function sendBroadcast(
  eventSlug: string,
  content: BroadcastContent,
  audience: BroadcastAudience,
) {
  return adminRequest<{ id: string; recipientCount: number }>("/admin/broadcasts", {
    method: "POST",
    body: JSON.stringify({ eventSlug, ...content, audience }),
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

export interface NewsletterListParams {
  page?: number;
  pageSize?: number;
}

export function listNewsletterSubscribers(params: NewsletterListParams = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    subscribers: NewsletterSubscriber[];
  }>(`/admin/newsletter?${query.toString()}`);
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

export interface AdminUsersListParams {
  page?: number;
  pageSize?: number;
}

export function listAdminUsers(params: AdminUsersListParams = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    users: AdminUserListItem[];
  }>(`/admin/users?${query.toString()}`);
}

export function createAdminUser(input: {
  name: string;
  email: string;
  password: string;
  role: CreatableAdminRole;
  permissions?: PermissionKey[];
}) {
  return adminRequest<AdminUserListItem>("/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateAdminUser(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    // AdminRole (not CreatableAdminRole) — 'super_admin' is a valid target
    // here, for promoting an existing organizer/door_staff. reason/password
    // are required by the backend only when role is 'super_admin'.
    role: AdminRole;
    notifyOnStudentRegistration: boolean;
    permissions: PermissionKey[];
    reason: string;
    password: string;
  }>,
) {
  return adminRequest<AdminUserListItem>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminUser(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/users/${id}`, {
    method: "DELETE",
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

export interface SpeakersListParams {
  page?: number;
  pageSize?: number;
}

export function listAdminSpeakers(
  eventSlug: string,
  params: SpeakersListParams = {},
) {
  const query = new URLSearchParams({ event: eventSlug });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    speakers: Speaker[];
  }>(`/admin/speakers?${query.toString()}`);
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

export interface SponsorsListParams {
  page?: number;
  pageSize?: number;
}

export function listAdminSponsors(
  eventSlug: string,
  params: SponsorsListParams = {},
) {
  const query = new URLSearchParams({ event: eventSlug });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    sponsors: Sponsor[];
  }>(`/admin/sponsors?${query.toString()}`);
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

export interface SponsorApplicationsListParams {
  status?: SponsorApplicationStatus;
  page?: number;
  pageSize?: number;
}

export function listSponsorApplications(
  eventSlug: string,
  params: SponsorApplicationsListParams = {},
) {
  const query = new URLSearchParams({ event: eventSlug });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    applications: SponsorApplication[];
  }>(`/admin/sponsor-applications?${query.toString()}`);
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

export interface EventSettings {
  ticketPurchasingPaused: boolean;
  volunteerApplicationsPaused: boolean;
  sponsorshipApplicationsPaused: boolean;
  categoryCapacities: CategoryAvailability[];
}

export interface UpdateEventSettingsInput {
  ticketPurchasingPaused?: boolean;
  volunteerApplicationsPaused?: boolean;
  sponsorshipApplicationsPaused?: boolean;
  categoryCapacities?: { category: Category; capacity: number }[];
}

export function getEventSettings(eventSlug: string) {
  return adminRequest<EventSettings>(
    `/admin/event-settings?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function updateEventSettings(
  eventSlug: string,
  input: UpdateEventSettingsInput,
) {
  return adminRequest<EventSettings>(
    `/admin/event-settings?event=${encodeURIComponent(eventSlug)}`,
    { method: "PATCH", body: JSON.stringify(input) },
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
  // Empty = valid for every category.
  categories: Category[];
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
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
  categories?: Category[];
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

export interface VolunteerApplicationsListParams {
  status?: VolunteerApplicationStatus;
  page?: number;
  pageSize?: number;
}

export function listVolunteerApplications(
  eventSlug: string,
  params: VolunteerApplicationsListParams = {},
) {
  const query = new URLSearchParams({ event: eventSlug });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    applications: VolunteerApplication[];
  }>(`/admin/volunteer-applications?${query.toString()}`);
}

export function approveVolunteerApplication(id: string, reason?: string) {
  return adminRequest<VolunteerApplication>(
    `/admin/volunteer-applications/${id}/approve`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export function rejectVolunteerApplication(id: string, reason: string) {
  return adminRequest<VolunteerApplication>(
    `/admin/volunteer-applications/${id}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}

export interface BulkVolunteerApplicationResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

export function bulkApproveVolunteerApplications(ids: string[], reason?: string) {
  return adminRequest<BulkVolunteerApplicationResult>(
    `/admin/volunteer-applications/bulk-approve`,
    { method: "POST", body: JSON.stringify({ ids, reason }) },
  );
}

export function bulkRejectVolunteerApplications(ids: string[], reason: string) {
  return adminRequest<BulkVolunteerApplicationResult>(
    `/admin/volunteer-applications/bulk-reject`,
    { method: "POST", body: JSON.stringify({ ids, reason }) },
  );
}

export interface AuditLogActor {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actor: AuditLogActor | null;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
  metadataJson: Record<string, unknown>;
}

export interface AuditLogListParams {
  page?: number;
  pageSize?: number;
  action?: string;
  from?: string;
  to?: string;
}

export interface AuditLogSystemListParams extends AuditLogListParams {
  actorId?: string;
}

function buildAuditLogQuery(params: AuditLogSystemListParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query;
}

export function fetchAuditLog(params: AuditLogSystemListParams) {
  const query = buildAuditLogQuery(params);
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    entries: AuditLogEntry[];
  }>(`/admin/audit-log?${query.toString()}`);
}

export function fetchMyActivity(params: AuditLogListParams) {
  const query = buildAuditLogQuery(params);
  return adminRequest<{
    total: number;
    page: number;
    pageSize: number;
    entries: AuditLogEntry[];
  }>(`/admin/audit-log/me?${query.toString()}`);
}

// One printable name tag — see backend TagsService.listTags.
export interface NameTag {
  id: string;
  name: string;
  label: string;
  title: string | null;
  organization: string | null;
}

export type TagSection = "committee" | "vips" | "registrants" | "speakers" | "sponsors";

export function fetchNameTags(eventSlug: string) {
  return adminRequest<Record<TagSection, NameTag[]>>(
    `/admin/tags?event=${encodeURIComponent(eventSlug)}`,
  );
}

// One person who will get a certificate — see backend CertificatesService.
export interface CertificateRecipient {
  id: string;
  name: string;
  email: string;
  delivery: "not_sent" | "queued" | "sent" | "failed";
  deliveryError: string | null;
  sentAt: string | null;
}

export function fetchCertificateRecipients(eventSlug: string) {
  return adminRequest<{ sendAt: string; recipients: CertificateRecipient[] }>(
    `/admin/certificates?event=${encodeURIComponent(eventSlug)}`,
  );
}

export interface OrganisingTeamMember {
  id: string;
  name: string;
  position: string;
}

export function fetchOrganisingTeam(eventSlug: string) {
  return adminRequest<OrganisingTeamMember[]>(
    `/admin/certificates/organising-team?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function sendTestCertificate(eventSlug: string, email: string, name?: string) {
  return adminRequest<{ sent: true }>(`/admin/certificates/test?event=${encodeURIComponent(eventSlug)}`, {
    method: "POST",
    body: JSON.stringify({ email, name: name || undefined }),
  });
}

export interface CommitteePosition {
  id: string;
  name: string;
  displayOrder: number;
  memberCount: number;
}

export interface CommitteeMember {
  id: string;
  fullName: string;
  positionId: string;
  position: { id: string; name: string };
}

export function fetchCommittee(eventSlug: string) {
  return adminRequest<{
    positions: CommitteePosition[];
    members: CommitteeMember[];
  }>(`/admin/tags/committee?event=${encodeURIComponent(eventSlug)}`);
}

export function createCommitteePosition(input: {
  eventSlug: string;
  name: string;
  displayOrder?: number;
}) {
  return adminRequest<CommitteePosition>("/admin/tags/positions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCommitteePosition(
  id: string,
  input: { name?: string; displayOrder?: number },
) {
  return adminRequest<CommitteePosition>(`/admin/tags/positions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCommitteePosition(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/tags/positions/${id}`, {
    method: "DELETE",
  });
}

export function createCommitteeMember(input: {
  eventSlug: string;
  fullName: string;
  positionId: string;
}) {
  return adminRequest<CommitteeMember>("/admin/tags/committee", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCommitteeMember(
  id: string,
  input: { fullName?: string; positionId?: string },
) {
  return adminRequest<CommitteeMember>(`/admin/tags/committee/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCommitteeMember(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/tags/committee/${id}`, {
    method: "DELETE",
  });
}

export interface VipGuest {
  id: string;
  fullName: string;
  title: string | null;
  organization: string | null;
  displayOrder: number;
}

export interface VipGuestInput {
  fullName: string;
  title: string;
  organization: string;
  displayOrder: number;
}

export function fetchVipGuests(eventSlug: string) {
  return adminRequest<VipGuest[]>(`/admin/tags/vips?event=${encodeURIComponent(eventSlug)}`);
}

export function createVipGuest(input: VipGuestInput & { eventSlug: string }) {
  return adminRequest<VipGuest>("/admin/tags/vips", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Blank title/organization clears that line from the tag.
export function updateVipGuest(id: string, input: Partial<VipGuestInput>) {
  return adminRequest<VipGuest>(`/admin/tags/vips/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteVipGuest(id: string) {
  return adminRequest<{ deleted: true }>(`/admin/tags/vips/${id}`, {
    method: "DELETE",
  });
}
