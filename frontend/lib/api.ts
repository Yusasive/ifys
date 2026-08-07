const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export type Category = "student" | "founder" | "professional";
export type Tier = "standard" | "premium";

export interface TicketProduct {
  id: string;
  category: Category;
  tier: Tier;
  priceKobo: number;
  currency: string;
  perksJson: Record<string, unknown>;
  isActive: boolean;
  discountPercent: number | null;
  discountExpiresAt: string | null;
  cardPriceLabel: string | null;
  cardNote: string | null;
}

export interface EventSummary {
  id: string;
  name: string;
  venue: string;
  startsAt: string;
  slug: string;
}

export interface ApiFieldError {
  message: string;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiFieldError,
  ) {
    super(body.message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as ApiFieldError;
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export function fetchTicketProducts(eventSlug: string) {
  return request<{ event: EventSummary; ticketProducts: TicketProduct[] }>(
    `/registrations/ticket-products?event=${encodeURIComponent(eventSlug)}`,
  );
}

export function requestStudentIdUploadUrl(fileName: string, contentType: string) {
  return request<{ key: string; uploadUrl: string }>(
    "/registrations/student-id-upload-url",
    { method: "POST", body: JSON.stringify({ fileName, contentType }) },
  );
}

export async function uploadStudentIdFile(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Failed to upload student ID file");
  }
}

export interface CreateRegistrationPayload {
  eventSlug: string;
  category: Category;
  tier: Tier;
  fullName: string;
  email: string;
  phone: string;
  formData: Record<string, unknown>;
  couponCode?: string;
}

export type CouponDiscountType = "percent" | "fixed";

export interface CouponValidation {
  valid: true;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  priceKobo: number;
  discountKobo: number;
  finalPriceKobo: number;
}

export function validateCoupon(input: {
  eventSlug: string;
  code: string;
  category: Category;
  tier: Tier;
}) {
  return request<CouponValidation>("/coupons/validate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Registration {
  id: string;
  status: string;
  formDataJson: Record<string, unknown>;
  studentIdFileUrl: string | null;
  createdAt: string;
  ticketProduct: TicketProduct;
  attendee: { id: string; fullName: string; email: string; phone: string };
  ticket: { ticketCode: string; status: string; qrDataUrl: string } | null;
}

// Only present in the response right after creation — proves ownership
// of this registration on subsequent lookups/checkout, since the id
// alone isn't treated as a sufficient secret.
export interface CreatedRegistration extends Registration {
  lookupToken: string;
}

export function createRegistration(payload: CreateRegistrationPayload) {
  return request<CreatedRegistration>("/registrations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchRegistration(id: string, token: string) {
  return request<Registration>(
    `/registrations/${id}?token=${encodeURIComponent(token)}`,
  );
}

// A direct download link (not a request<T> JSON call) — the browser
// navigates/downloads this URL itself, same auth model as fetchRegistration.
export function ticketPdfUrl(registrationId: string, token: string): string {
  return `${API_BASE_URL}/registrations/${registrationId}/ticket.pdf?token=${encodeURIComponent(token)}`;
}

export function createCheckout(registrationId: string, token: string) {
  return request<{ authorizationUrl: string; reference: string }>(
    `/registrations/${registrationId}/checkout?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
}

// Actively asks the backend to re-check this registration's payment with
// Paystack directly, instead of only ever waiting for the webhook to have
// already settled it — the confirmation page calls this once on load as a
// fast-path/fallback for when the webhook is slow, misconfigured, or never
// arrives.
export function verifyRegistrationPayment(registrationId: string, token: string) {
  return request<{ status: string }>(
    `/registrations/${registrationId}/verify-payment?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  tag: string;
  bio: string | null;
  photoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export function listSpeakers(eventSlug: string) {
  return request<{ event: EventSummary; speakers: Speaker[] }>(
    `/speakers?event=${encodeURIComponent(eventSlug)}`,
  );
}

export type SponsorType = "sponsor" | "partner" | "exhibitor";

export interface Sponsor {
  id: string;
  type: SponsorType;
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

export function listSponsors(eventSlug: string) {
  return request<{ event: EventSummary; sponsors: Sponsor[] }>(
    `/sponsors?event=${encodeURIComponent(eventSlug)}`,
  );
}

export interface CreateSponsorApplicationPayload {
  eventSlug: string;
  type: SponsorType;
  organizationName: string;
  contactName: string;
  email: string;
  phone?: string;
  websiteUrl?: string;
  budgetNote?: string;
  message?: string;
  logoKey?: string;
}

export function createSponsorApplication(payload: CreateSponsorApplicationPayload) {
  return request<{ id: string }>("/sponsor-applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function requestSponsorApplicationUploadUrl(fileName: string, contentType: string) {
  return request<{ key: string; uploadUrl: string }>(
    "/sponsor-applications/upload-url",
    { method: "POST", body: JSON.stringify({ fileName, contentType }) },
  );
}

export async function uploadSponsorApplicationLogo(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error("Failed to upload logo");
  }
}

export function subscribeToNewsletter(email: string) {
  return request<{ id: string }>("/newsletter", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export const VOLUNTEER_TEAMS = [
  { value: "programs", label: "Program Team" },
  { value: "partnerships_sponsorships", label: "Partnership and Sponsorship Team" },
  { value: "marketing_communications", label: "Content, Communications and Social Media Team" },
  { value: "operations_logistics", label: "Logistics and Operations Team" },
  { value: "design_branding", label: "Design and Branding Team" },
  { value: "photography_videography", label: "Photography and Videography Team" },
  { value: "welfare_hospitality", label: "Welfare and Hospitality Team" },
  { value: "registration_ticketing", label: "Ticketing and Registration Team" },
] as const;

export type VolunteerTeam = (typeof VOLUNTEER_TEAMS)[number]["value"];

export const VOLUNTEER_SKILLS = [
  "Communications",
  "Graphics Design",
  "Photography/Videography",
  "Social Media Management",
  "IT Support",
];

export const VOLUNTEER_AREAS = [
  "Program Management",
  "Partnership and Sponsorship",
  "Programs and Speakers",
  "Content, Communications and social media",
  "Logistics and Operations",
  "Ticketing",
  "Guests Experience",
];

export interface CreateVolunteerApplicationPayload {
  eventSlug: string;
  fullName: string;
  phone: string;
  email: string;
  location: string;
  willingToTravel: "yes" | "no" | "maybe";
  occupationalStatus:
    | "student"
    | "employed"
    | "self_employed"
    | "entrepreneur"
    | "unemployed"
    | "other";
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

export function createVolunteerApplication(payload: CreateVolunteerApplicationPayload) {
  return request<{ id: string }>("/volunteer-applications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
