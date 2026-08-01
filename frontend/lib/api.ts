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
}

export interface Registration {
  id: string;
  status: string;
  formDataJson: Record<string, unknown>;
  studentIdFileUrl: string | null;
  createdAt: string;
  ticketProduct: TicketProduct;
  attendee: { id: string; fullName: string; email: string; phone: string };
}

export function createRegistration(payload: CreateRegistrationPayload) {
  return request<Registration>("/registrations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchRegistration(id: string) {
  return request<Registration>(`/registrations/${id}`);
}

export function createCheckout(registrationId: string) {
  return request<{ authorizationUrl: string; reference: string }>(
    `/registrations/${registrationId}/checkout`,
    { method: "POST" },
  );
}
